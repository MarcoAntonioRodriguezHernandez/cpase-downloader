import fs from "fs";
import path from "path";

/* ======================================================
   CONFIGURACIÓN
====================================================== */

const LOG_DIR = path.resolve("./logs");
fs.mkdirSync(LOG_DIR, { recursive: true });

const timestampArchivo = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const LOG_FILE = path.join(
    LOG_DIR,
    `ejecucion-${timestampArchivo}.log`
);

/* ======================================================
   HELPERS
====================================================== */

function timestamp() {
    return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function escribirLog(linea) {
    fs.appendFileSync(LOG_FILE, linea + "\n");
}

function log(linea) {
    console.log(linea);
    escribirLog(linea);
}

function logErrorInterno(linea) {
    console.error(linea);
    escribirLog(linea);
}

/* ======================================================
   LOGS PÚBLICOS
====================================================== */

export function logEmpresa(nombre) {
    const linea = `${timestamp()} | 🏢 EMPRESA   | ${nombre}`;
    log("\n" + linea);
}

export function logProveedor(nombre, rfc) {
    const linea = `${timestamp()} | 👤 PROVEEDOR | ${nombre} (${rfc})`;
    log(linea);
}

export function logPeriodo(año, mes) {
    const linea = `${timestamp()} | 📅 PERIODO  | ${año} / ${mes}`;
    log(linea);
}

export function logCFDI(nombreBase, indice) {
    const linea = `${timestamp()} | 📄 CFDI     | ${nombreBase}_${indice} ✅`;
    log(linea);
}

export function logSinDatos() {
    const linea = `${timestamp()} | ⚠️  INFO     | Sin CFDIs`;
    log(linea);
}

export function logError(contexto, error) {
    const linea = `${timestamp()} | ❌ ERROR    | ${contexto}`;
    logErrorInterno(linea);

    if (error?.message) {
        logErrorInterno(`${timestamp()} | ❌ ERROR    | ${error.message}`);
    }
}
