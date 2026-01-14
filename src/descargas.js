//src/descargas.js
import fs from "fs";
import path from "path";
import { descargarXMLConPuppeteer } from "./browser.js";
import { MESES, normalizarTexto } from "./utils.js";
import {
    logPeriodo,
    logCFDI,
    logSinDatos,
    logError
} from "./logger.js";
import {ejecutarConPool} from "./pool.js";

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
    logPeriodo(año, MESES[periodo]);
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

    if (!data?.length) {
        logSinDatos();
        return;
    }

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

    // 🧠 CONTADOR EN MEMORIA POR EMPLEADO
    const contadorPorEmpleado = inicializarContadores(rutaDestino);

    for (const item of data) {
        const { data: cfdis } = await client.post(
            "/services/getCFDISCargados.php",
            {
                detalleId: item.detalleId,
                allPks: item.allPks
            }
        );

        await ejecutarConPool(
            cfdis,
            3, // ← CONCURRENCIA (2 o 3 recomendado)
            (cfdi) =>
                descargarCFDI({
                    client,
                    cfdi,
                    rutaDestino,
                    EMPRESA_ID,
                    rfcProveedor: rfc,
                    contadorPorEmpleado
                })
        );

    }
}

/* ======================================================
   DESCARGA INDIVIDUAL
   ✔ CONTADOR EN MEMORIA
====================================================== */

async function descargarCFDI({
     client,
     cfdi,
     rutaDestino,
     EMPRESA_ID,
     rfcProveedor,
     contadorPorEmpleado
 }) {
    const inicioDescarga = Date.now();
    const uuid = cfdi.UUID;
    const pk = cfdi.pk_validacion;

    const nombreBase = cfdi.Nombre
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "")
        .toUpperCase();

    contadorPorEmpleado[nombreBase] ??= 0;
    contadorPorEmpleado[nombreBase]++;
    const indice = contadorPorEmpleado[nombreBase];

    const cookies = obtenerCookies(client);

    try {
        // ✅ DESCARGAR LOS 3 ARCHIVOS EN PARALELO
        await Promise.all([
            // 1️⃣ Helper PDF
            descargarXMLConPuppeteer(
                `https://cpase.cpavision.mx/proveedor/servicios-especializados/helper/helper.php` +
                `?uuid=${Buffer.from(uuid).toString("base64")}` +
                `&empresaRfc=${Buffer.from(rfcProveedor).toString("base64")}` +
                `&download=true`,
                path.join(rutaDestino, `${nombreBase}_${indice}.pdf`),
                cookies
            ),

            // 2️⃣ XML
            descargarXMLConPuppeteer(
                `https://cpase.cpavision.mx/services/descargar-xml.php` +
                `?file_name=${uuid}.xml&type=xml&emp=${EMPRESA_ID}`,
                path.join(rutaDestino, `${nombreBase}_${indice}.xml`),
                cookies
            ),

            // 3️⃣ Recibo PDF (axios)
            (async () => {
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
            })()
        ]);

        const tiempoTotal = ((Date.now() - inicioDescarga) / 1000).toFixed(2);
        logCFDI(nombreBase, indice, tiempoTotal);

    } catch (error) {
        logError(`Error descargando CFDI ${nombreBase}_${indice} (UUID: ${uuid})`, error);
    }
}

/* ======================================================
   INICIALIZAR CONTADORES DESDE FS (UNA SOLA VEZ)
====================================================== */

function inicializarContadores(rutaDestino) {
    const contadores = {};

    if (!fs.existsSync(rutaDestino)) return contadores;

    const archivos = fs.readdirSync(rutaDestino);

    for (const archivo of archivos) {
        const match = archivo.match(/^(.+?)_(\d+)\.xml$/i);
        if (!match) continue;

        const nombre = match[1];
        const indice = parseInt(match[2], 10);

        contadores[nombre] = Math.max(contadores[nombre] ?? 0, indice);
    }

    return contadores;
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
