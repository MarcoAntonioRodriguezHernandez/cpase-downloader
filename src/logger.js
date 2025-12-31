import fs from "fs";
import path from "path";
import chalk from "chalk";

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
    const fecha = new Date().toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    const [fechaParte, horaParte] = fecha.split(", ");
    const [dia, mes, año] = fechaParte.split("/");

    return `${año}-${mes}-${dia} ${horaParte}`;
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

export function logCFDI(nombre, indice, tiempoSegundos) {
    console.log(chalk.green(`   ✓ ${nombre}_${indice} (${tiempoSegundos}s)`));
}

export function logFinProveedor(razonSocial, tiempoSegundos) {
    console.log(chalk.magenta(`\n✅ Proveedor completado: ${razonSocial} - Tiempo total: ${tiempoSegundos}s`));
}

export function logFinEmpresa(nombre, tiempoSegundos) {
    console.log(chalk.green.bold(`\n🎉 EMPRESA COMPLETADA: ${nombre} - Tiempo total: ${tiempoSegundos}s\n`));
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
