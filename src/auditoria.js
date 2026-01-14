// src/auditoria.js
import { normalizarTexto, normalizarRazonSocialFiscal } from "./utils.js";
import {debeEjecutar} from "./resume.js";
import path from "path";
import fs from "fs";
import {escanearCarpetaLocal} from "./escaneo-local.js";
import chalk from "chalk";
import {logEmpresa, logError, logProveedor} from "./logger.js";

 /**
  * Realiza una auditoría de empleados a descargar por empresa
  * @param {Object} params - Parámetros de auditoría
  * @param {Object} params.client - Cliente HTTP configurado
  * @param {Array} params.proveedores - Lista de proveedores
  * @param {Array} params.años - Años a auditar
  * @param {Array} params.periodos - Períodos (meses) a auditar
  * @param {string} params.EMPRESA_ID - ID de la empresa
  * @param {string} params.RFC_EMPRESA - RFC de la empresa
  * @param {string} params.NOMBRE_EMPRESA - Nombre de la empresa
  * @returns {Promise<Array>} - Resultados de la auditoría
  */
 export async function auditarEmpleados({ client, proveedores, años, periodos, EMPRESA_ID, RFC_EMPRESA, NOMBRE_EMPRESA, resume }) {
     const resultados = [];

     console.log(`\n${"=".repeat(80)}`);
     logEmpresa(`🔍 AUDITORÍA - ${NOMBRE_EMPRESA}`);
     console.log(`${"=".repeat(80)}\n`);

     for (const proveedor of proveedores) {
         logProveedor(proveedor.razon_social, proveedor.rfc);

         for (const año of años) {
             for (const periodo of periodos) {
                 if (!debeEjecutar({ proveedor, año, periodo, resume })) {
                     continue;
                 }
                 try {
                     const empleados = await obtenerEmpleadosProveedor({
                         client,
                         proveedor,
                         año,
                         periodo,
                         EMPRESA_ID,
                         RFC_EMPRESA
                     });

                     if (empleados && empleados.length > 0) {
                         const mesNombre = new Date(año, periodo, 1).toLocaleDateString('es-MX', { month: 'long' });

                         console.log(`  └─ ${año} - ${mesNombre}: ${empleados.length} empleado(s)`);
                         fs.appendFileSync(
                             path.resolve("./logs", fs.readdirSync("./logs").sort().pop()),
                             `  └─ ${año} - ${mesNombre}: ${empleados.length} empleado(s)\n`
                         );

                         empleados.forEach(emp => {
                             const msg = `     • ${emp.Nombre || 'Sin nombre'} (${emp.RFC || 'Sin RFC'})`;
                             console.log(msg);
                             fs.appendFileSync(
                                 path.resolve("./logs", fs.readdirSync("./logs").sort().pop()),
                                 msg + "\n"
                             );
                         });

                         resultados.push({
                             proveedor: proveedor.razon_social,
                             proveedorRFC: proveedor.rfc,
                             año,
                             mes: periodo,
                             mesNombre,
                             cantidadEmpleados: empleados.length,
                             empleados: empleados.map(e => ({
                                 nombre: e.Nombre || 'Sin nombre',
                                 rfc: e.RFC || 'Sin RFC',
                                 uuid: e.UUID || 'Sin UUID'
                             }))
                         });
                     }
                 } catch (error) {
                     logError(`${año}/${periodo + 1}`, error);
                 }
             }
         }
     }

     return resultados;
 }

 /**
  * Obtiene la lista de empleados usando el mismo endpoint que las descargas
  * @param {Object} params - Parámetros de consulta
  * @returns {Promise<Array>} - Lista de empleados (CFDIs)
  */
 async function obtenerEmpleadosProveedor({ client, proveedor, año, periodo, EMPRESA_ID, RFC_EMPRESA }) {
     try {
         // 1️⃣ Obtener datos del proveedor (igual que en descargas)
         const { data } = await client.post(
             "/services/refactorNomina.php",
             {
                 rfcProveedor: proveedor.rfc,
                 empresa: EMPRESA_ID,
                 filter: true,
                 ejercicio: año,
                 periodo,
                 rfcEmpresa: RFC_EMPRESA
             }
         );

         if (!data?.length) {
             return [];
         }

         // 2️⃣ Obtener CFDIs de cada detalle
         const todosLosCFDIs = [];

         for (const item of data) {
             const { data: cfdis } = await client.post(
                 "/services/getCFDISCargados.php",
                 {
                     detalleId: item.detalleId,
                     allPks: item.allPks
                 }
             );

             if (cfdis && cfdis.length > 0) {
                 todosLosCFDIs.push(...cfdis);
             }
         }

         return todosLosCFDIs;

     } catch (error) {
         throw new Error(`Error al obtener empleados: ${error.message}`);
     }
 }

function escribirLog(mensaje) {
    const logFile = path.resolve("./logs", fs.readdirSync("./logs").sort().pop());
    const mensajeLimpio = mensaje.replace(/\x1b\[[0-9;]*m/g, '');
    fs.appendFileSync(logFile, mensajeLimpio + "\n");
}

 /**
  * Exporta los resultados de auditoría a un archivo JSON
  * @param {Array} resultados - Resultados de la auditoría
  * @param {string} nombreEmpresa - Nombre de la empresa
  */
export function exportarAuditoria(resultados, nombreEmpresa) {
    const fecha = new Date().toISOString().split('T')[0];
    const nombreArchivo = `auditoria_${normalizarTexto(nombreEmpresa)}_${fecha}.json`;
    const rutaArchivo = path.resolve(`./auditorias/${nombreArchivo}`);

    // Crear directorio si no existe
    fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });

    // Resumen
    const resumen = {
        empresa: nombreEmpresa,
        fecha,
        totalProveedores: [...new Set(resultados.map(r => r.proveedorRFC))].length,
        totalRegistros: resultados.length,
        totalEmpleados: resultados.reduce((sum, r) => sum + r.cantidadEmpleados, 0),
        detalle: resultados
    };

    fs.writeFileSync(rutaArchivo, JSON.stringify(resumen, null, 2));

     const msg = `\n💾 Auditoría exportada: ${rutaArchivo}`;
     console.log(msg);
     escribirLog(msg);

}

/**
 * Compara empleados esperados vs archivos en carpeta local
 */

export async function compararConCarpetaLocal({
    baseDir,
    esperados,
    NOMBRE_EMPRESA
}) {
    const faltantes = [];
    let totalRevisados = 0;
    let totalEncontrados = 0;

    const nombreEmpresaNormalizado = normalizarTexto(NOMBRE_EMPRESA);

    const msgInicio = `🔍 Comparando con carpeta local: ${baseDir}`;
    console.log(`\n${msgInicio}\n`);
    escribirLog(msgInicio);

    for (const registro of esperados) {
        const rutaEsperada = [
            nombreEmpresaNormalizado,
            normalizarRazonSocialFiscal(registro.proveedor),
            'repse',
            String(registro.año),
            registro.mesNombre,
            'cfdis_de_nomina'
        ];

        const archivosEnCarpeta = escanearCarpetaLocal(baseDir, rutaEsperada);
        const rutaCompleta = path.join(baseDir, ...rutaEsperada);

        // Contar empleados duplicados
        const indiceActual = {};
        registro.empleados.forEach(emp => {
            if (!indiceActual[emp.nombre]) {
                indiceActual[emp.nombre] = 1;
            }
        });

        let faltantesEnPeriodo = 0;

        const msgPeriodo = `📁 ${registro.proveedor} - ${registro.año}/${registro.mesNombre}`;
        const msgRuta = `   Ruta: ${rutaCompleta}`;
        console.log(chalk.cyan(`\n${msgPeriodo}`));
        console.log(chalk.gray(msgRuta + "\n"));
        escribirLog(msgPeriodo);
        escribirLog(msgRuta);

        for (const empleado of registro.empleados) {
            totalRevisados++;
            const nombreBase = empleado.nombre
                .replace(/\s+/g, "_")
                .replace(/[^\w_]/g, "")
                .toUpperCase();

            const sufijo = indiceActual[empleado.nombre];

            // 3 archivos esperados
            const archivosEsperados = [
                `${nombreBase}_${sufijo}.pdf`,
                `${nombreBase}_${sufijo}.xml`,
                `${nombreBase}_verificador_recibo_nomina_${sufijo}.pdf`
            ];

            const archivosFaltantes = archivosEsperados.filter(archivo =>
                !archivosEnCarpeta.some(x => x.nombre === archivo)
            );

            if (archivosFaltantes.length > 0) {
                // ❌ EMPLEADO CON ARCHIVOS FALTANTES
                faltantesEnPeriodo++;
                const msgEmpleado = `   ❌ ${empleado.nombre} (${empleado.rfc})`;
                console.log(chalk.red(msgEmpleado));
                escribirLog(msgEmpleado);

                archivosFaltantes.forEach(archivo => {
                    const msgFalta = `      └─ Falta: ${archivo}`;
                    console.log(chalk.red(msgFalta));
                    escribirLog(msgFalta);
                });

                const msgUUID = `      🔑 UUID: ${empleado.uuid}`;
                console.log(chalk.gray(msgUUID + "\n"));
                escribirLog(msgUUID);

                faltantes.push({
                    proveedor: registro.proveedor,
                    año: registro.año,
                    mes: registro.mesNombre,
                    empleado: empleado.nombre,
                    rfc: empleado.rfc,
                    uuid: empleado.uuid,
                    archivosFaltantes,
                    rutaEsperada: rutaCompleta
                });
            } else {
                // ✅ EMPLEADO COMPLETO (logs compactos)
                totalEncontrados++;
                const msgEmpleado = `   ✓ ${empleado.nombre} (${empleado.rfc})`;
                console.log(chalk.green(msgEmpleado));
                escribirLog(msgEmpleado);

                archivosEsperados.forEach(archivo => {
                    const msgArchivo = `      └─ ${archivo}`;
                    console.log(chalk.green(msgArchivo));
                    escribirLog(msgArchivo);
                });
                console.log();
            }

            indiceActual[empleado.nombre]++;
        }

        // Resumen del período
        const emoji = faltantesEnPeriodo === 0 ? "✅" : "⚠️";
        const stats = `${registro.cantidadEmpleados - faltantesEnPeriodo}/${registro.cantidadEmpleados}`;

        const msgResumen = `${emoji} Resumen: ${stats} empleados completos`;
        console.log(chalk.bold(msgResumen));
        escribirLog(msgResumen);

        if (faltantesEnPeriodo > 0) {
            const msgFaltantes = `   └─ ${faltantesEnPeriodo} empleado(s) con archivos faltantes`;
            console.log(chalk.yellow(msgFaltantes + "\n"));
            escribirLog(msgFaltantes);
        }
    }

    // Resumen final
    const separador = "=".repeat(80);
    console.log(`\n${separador}`);
    escribirLog(separador);

    const tituloResumen = "📊 RESUMEN DE COMPARACIÓN";
    console.log(chalk.bold.cyan(tituloResumen));
    escribirLog(tituloResumen);

    console.log(separador);
    escribirLog(separador);

    const msgCompletos = `✅ Empleados completos: ${totalEncontrados}/${totalRevisados}`;
    console.log(chalk.green(msgCompletos));
    escribirLog(msgCompletos);

    const msgFaltantes = `❌ Empleados con archivos faltantes: ${faltantes.length}`;
    console.log(chalk.red(msgFaltantes));
    escribirLog(msgFaltantes);

    console.log(separador + "\n");
    escribirLog(separador);

    return { faltantes };
}

export function exportarAuditoriaComparativa(faltantes, extras, nombreEmpresa) {
    const fecha = new Date().toISOString().split('T')[0];
    const nombreArchivo = `auditoria_drive_${normalizarTexto(nombreEmpresa)}_${fecha}.json`;
    const rutaArchivo = path.resolve(`./auditorias/${nombreArchivo}`);

    fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });

    const reporte = {
        empresa: nombreEmpresa,
        fecha,
        totalFaltantes: faltantes.length,
        faltantes
    };

    fs.writeFileSync(rutaArchivo, JSON.stringify(reporte, null, 2));

    const msg1 = `💾 Auditoría Drive exportada: ${rutaArchivo}`;
    const msg2 = `❌ CFDIs faltantes: ${faltantes.length}`;
    console.log(`\n${msg1}`);
    escribirLog(msg1);
    console.log(msg2);
    escribirLog(msg2);
}
