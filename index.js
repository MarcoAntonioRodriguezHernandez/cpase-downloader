import axios from "axios";
import fs from "fs";
import path from "path";
import { descargarXMLConPuppeteer } from "./src/browser.js";

/* =====================================================
   CONFIGURACIÓN GENERAL
===================================================== */

// Carpeta destino FINAL (plana)
const BASE_DIR = path.resolve(
    "./documentos/cotemar/nombre_cliente/nombre_subcliente/repse/2021/septiembre/cfdis_de_nomina"
);

fs.mkdirSync(BASE_DIR, { recursive: true });

// Normalizar nombre de empleado
function normalizarNombre(nombre) {
    return nombre
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "")
        .toUpperCase();
}

// Axios SOLO para servicios backend
const client = axios.create({
    baseURL: "https://cpase.cpavision.mx",
    withCredentials: true,
    headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer":
            "https://cpase.cpavision.mx/proveedor/dashboard/proveedoresMes/index.php?emp=62660"
    }
});

// Cookies de sesión
client.defaults.headers.Cookie =
    "PHPSESSID=uas3vlkpskg2ku5hf3tchufn8n; state=c0fd5770fd694470bd1c776a7d879373";

/* =====================================================
   FUNCIÓN PRINCIPAL
===================================================== */

async function descargar() {
    const { data: cfdis } = await client.post(
        "/services/getCFDISCargados.php",
        {
            detalleId: "5097819",
            allPks: "MTAyODcyODE4NzUsMTAyODcyODE4NzY="
        }
    );

    const cookies = obtenerCookiesParaPuppeteer();
    const contadorPorEmpleado = {};

    for (const cfdi of cfdis) {
        const uuid = cfdi.UUID;
        const pk = cfdi.pk_validacion;
        const nombreEmpleado = normalizarNombre(cfdi.Nombre);

        // Índice incremental por empleado
        contadorPorEmpleado[nombreEmpleado] ??= 0;
        contadorPorEmpleado[nombreEmpleado]++;
        const indice = contadorPorEmpleado[nombreEmpleado];

        const uuidBase64 = Buffer.from(uuid).toString("base64");
        const empresaRfcBase64 = Buffer.from("RORA4705033Q7").toString("base64");

        /* ================= XML HELPER ================= */
        const helperUrl =
            `https://cpase.cpavision.mx/proveedor/servicios-especializados/helper/helper.php` +
            `?uuid=${uuidBase64}&empresaRfc=${empresaRfcBase64}&download=true`;

        await descargarXMLConPuppeteer(
            helperUrl,
            path.join(BASE_DIR, `${nombreEmpleado}_${indice}_helper.pdf`),
            cookies
        );

        /* ================= XML PROCESADO ================= */
        const procesadoUrl =
            `https://cpase.cpavision.mx/services/descargar-xml.php` +
            `?file_name=${uuid}.xml&type=xml&emp=62660`;

        await descargarXMLConPuppeteer(
            procesadoUrl,
            path.join(BASE_DIR, `${nombreEmpleado}_${indice}.xml`),
            cookies
        );

        /* ================= PDF ================= */
        const pdf = await client.get(
            `/services/dictamen-pdf.php?id=${pk}&emp=62660`,
            { responseType: "arraybuffer" }
        );

        fs.writeFileSync(
            path.join(
                BASE_DIR,
                `${nombreEmpleado}_verificador_recibo_nomina_${indice}.pdf`
            ),
            pdf.data
        );

        console.log(`✔ Guardado: ${nombreEmpleado} (${indice})`);
    }
}

/* =====================================================
   COOKIES PARA PUPPETEER
===================================================== */

function obtenerCookiesParaPuppeteer() {
    const raw = client.defaults.headers.Cookie;

    return raw.split(";").map(c => {
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

descargar().catch(console.error);
