import fs from "fs";
import path from "path";
import { descargarXMLConPuppeteer } from "./browser.js";
import { MESES, normalizarTexto } from "./utils.js";

export async function descargarCFDISProveedor({
      client,
      proveedor,
      año,
      periodo,
      EMPRESA_ID,
      RFC_EMPRESA,
      NOMBRE_EMPRESA,
      BASE_DIR
  }) {
    const { rfc, razon_social } = proveedor;

    const { data } = await client.post(
        "/services/refactorNomina.php",
        {
            rfcProveedor: rfc,
            empresa: EMPRESA_ID,
            filter: true,
            ejercicio: año,
            periodo,
            rfcEmpresa: RFC_EMPRESA
        }
    );

    if (!data?.length) return;

    const rutaDestino = path.join(
        BASE_DIR,
        normalizarTexto(NOMBRE_EMPRESA),
        normalizarTexto(razon_social),
        "repse",
        String(año),
        MESES[periodo],
        "cfdis_de_nomina"
    );

    fs.mkdirSync(rutaDestino, { recursive: true });

    for (const item of data) {
        const { data: cfdis } = await client.post(
            "/services/getCFDISCargados.php",
            {
                detalleId: item.detalleId,
                allPks: item.allPks
            }
        );

        for (const cfdi of cfdis) {
            await descargarCFDI({
                client,
                cfdi,
                rutaDestino,
                EMPRESA_ID,
                rfcProveedor: rfc
            });
        }
    }
}

/* ======================================================
   DESCARGA INDIVIDUAL CON CONTADOR REAL
====================================================== */

async function descargarCFDI({
                                 client,
                                 cfdi,
                                 rutaDestino,
                                 EMPRESA_ID,
                                 rfcProveedor
                             }) {
    const uuid = cfdi.UUID;
    const pk = cfdi.pk_validacion;

    const nombreBase = cfdi.Nombre
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "")
        .toUpperCase();

    const indice = obtenerSiguienteIndice(rutaDestino, nombreBase);

    const cookies = obtenerCookies(client);

    /* ================= HELPER PDF ================= */

    const helperUrl =
        `https://cpase.cpavision.mx/proveedor/servicios-especializados/helper/helper.php` +
        `?uuid=${Buffer.from(uuid).toString("base64")}` +
        `&empresaRfc=${Buffer.from(rfcProveedor).toString("base64")}` +
        `&download=true`;

    await descargarXMLConPuppeteer(
        helperUrl,
        path.join(rutaDestino, `${nombreBase}_${indice}.pdf`),
        cookies
    );

    /* ================= XML ================= */

    const xmlUrl =
        `https://cpase.cpavision.mx/services/descargar-xml.php` +
        `?file_name=${uuid}.xml&type=xml&emp=${EMPRESA_ID}`;

    await descargarXMLConPuppeteer(
        xmlUrl,
        path.join(rutaDestino, `${nombreBase}_${indice}.xml`),
        cookies
    );

    /* ================= RECIBO PDF ================= */

    const pdf = await client.get(
        `/services/dictamen-pdf.php?id=${pk}&emp=${EMPRESA_ID}`,
        { responseType: "arraybuffer" }
    );

    fs.writeFileSync(
        path.join(
            rutaDestino,
            `${nombreBase}_verificador_recibo_nomina_${indice}.pdf`
        ),
        pdf.data
    );

    console.log(`✔ ${nombreBase}_${indice}`);
}

/* ======================================================
   CONTADOR REAL POR EMPLEADO (FS-SAFE)
====================================================== */

function obtenerSiguienteIndice(rutaDestino, nombreBase) {
    if (!fs.existsSync(rutaDestino)) return 1;

    const archivos = fs.readdirSync(rutaDestino);

    const regex = new RegExp(`^${nombreBase}_(\\d+)\\.`, "i");

    let max = 0;

    for (const archivo of archivos) {
        const match = archivo.match(regex);
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > max) max = n;
        }
    }

    return max + 1;
}

/* ======================================================
   COOKIES
====================================================== */

function obtenerCookies(client) {
    return client.defaults.headers.Cookie.split(";").map(c => {
        const [name, ...rest] = c.trim().split("=");
        return {
            name,
            value: rest.join("="),
            domain: "cpase.cpavision.mx",
            path: "/",
            httpOnly: true,
            secure: true
        };
    });
}
