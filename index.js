import axios from "axios";
import fs from "fs";
import path from "path";
import { descargarXMLConPuppeteer } from "./src/browser.js";

const XML_DIR = path.resolve("./xml");
const PDF_DIR = path.resolve("./pdf");

if (!fs.existsSync(XML_DIR)) {
    fs.mkdirSync(XML_DIR, { recursive: true });
}

if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
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
    "PHPSESSID=uas3vlkpskg2ku5hf3tchufn8n; state=ab557041b98b4ab0919867c90f3c67df";

async function descargar() {
    const { data: cfdis } = await client.post(
        "/services/getCFDISCargados.php",
        {
            detalleId: "5097819",
            allPks: "MTAyODcyODE4NzUsMTAyODcyODE4NzY="
        }
    );
    const cookies = obtenerCookiesParaPuppeteer();

    for (const cfdi of cfdis) {
        const uuid = cfdi.UUID;
        const pk = cfdi.pk_validacion;

        const uuidBase64 = Buffer.from(uuid).toString("base64");
        const empresaRfcBase64 = Buffer.from("RORA4705033Q7").toString("base64");

        // 🔹 XML ORIGINAL (helper.php) — Puppeteer
        const helperUrl =
            `https://cpase.cpavision.mx/proveedor/servicios-especializados/helper/helper.php` +
            `?uuid=${uuidBase64}&empresaRfc=${empresaRfcBase64}&download=true`;


        await descargarXMLConPuppeteer(
            helperUrl,
            path.join(XML_DIR, `${uuid}_helper.pdf`),
            cookies
        );

        // 🔹 XML PROCESADO (descargar-xml.php) — Puppeteer
        const procesadoUrl =
            `https://cpase.cpavision.mx/services/descargar-xml.php` +
            `?file_name=${uuid}.xml&type=xml&emp=62660`;

        await descargarXMLConPuppeteer(
            procesadoUrl,
            path.join(XML_DIR, `${uuid}_procesado.xml`),
            cookies
        );

        // 🔹 PDF (dictamen) — Axios
        const pdf = await client.get(
            `/services/dictamen-pdf.php?id=${pk}&emp=62660`,
            { responseType: "arraybuffer" }
        );

        fs.writeFileSync(
            path.join(PDF_DIR, `${uuid}.pdf`),
            pdf.data
        );

        console.log(`Descargadas las 3 acciones de: ${uuid}`);
    }
}

descargar().catch(console.error);
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