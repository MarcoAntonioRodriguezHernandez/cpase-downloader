// src/auditoria.js
import { normalizarTexto, normalizarRazonSocialFiscal } from "./utils.js";
import {debeEjecutar} from "./resume.js";
import path from "path";
import fs from "fs";
import {escanearCarpetaLocal} from "./escaneo-local.js";

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
     console.log(`🔍 AUDITORÍA DE EMPLEADOS - ${NOMBRE_EMPRESA}`);
     console.log(`${"=".repeat(80)}\n`);

     for (const proveedor of proveedores) {
         console.log(`\n📋 Proveedor: ${proveedor.razon_social} (${proveedor.rfc})`);

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

                         empleados.forEach(emp => {
                             console.log(`     • ${emp.Nombre || 'Sin nombre'} (${emp.RFC || 'Sin RFC'})`);
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
                     console.error(`  └─ ❌ Error en ${año}/${periodo + 1}: ${error.message}`);
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

    console.log(`\n💾 Auditoría exportada: ${rutaArchivo}`);
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

    console.log(`\n🔍 Comparando con carpeta local: ${baseDir}\n`);

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

        // Contar ocurrencias de cada empleado
        const conteoEmpleados = {};
        const indiceActual = {}; // Rastrear índice actual para cada empleado

        registro.empleados.forEach(emp => {
            if (!indiceActual[emp.nombre]) {
                indiceActual[emp.nombre] = 1;
            }
        });

        let faltantesEnPeriodo = 0;

        for (const empleado of registro.empleados) {
            totalRevisados++;
            const nombreBase = empleado.nombre
                .replace(/\s+/g, "_")
                .replace(/[^\w_]/g, "")
                .toUpperCase();

            const sufijo = indiceActual[empleado.nombre];

            // 🔍 ARCHIVOS ESPERADOS (3 archivos por empleado)
            const archivosEsperados = [
                `${nombreBase}_${sufijo}.pdf`,
                `${nombreBase}_${sufijo}.xml`,
                `${nombreBase}_verificador_recibo_nomina_${sufijo}.pdf`
            ];

            const archivosFaltantes = archivosEsperados.filter(archivo =>
                !archivosEnCarpeta.some(x => x.nombre === archivo)
            );

            if (archivosFaltantes.length > 0) {
                faltantesEnPeriodo++;
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

                console.log(`  ❌ ${empleado.nombre} (${empleado.rfc})`);
                console.log(`     📁 Ruta: ${rutaCompleta}`);
                archivosFaltantes.forEach(archivo => {
                    console.log(`     ❌ Falta: ${archivo}`);
                });
                console.log(`     🔑 UUID: ${empleado.uuid}\n`);
            } else {
                totalEncontrados++;
            }

            // Decrementar índice para próxima ocurrencia
            indiceActual[empleado.nombre]++;
        }

        const emoji = faltantesEnPeriodo === 0 ? "✅" : "⚠️";
        const stats = `${registro.cantidadEmpleados - faltantesEnPeriodo}/${registro.cantidadEmpleados}`;

        console.log(`${emoji} ${registro.proveedor} - ${registro.año}/${registro.mesNombre} (${stats})`);

        if (faltantesEnPeriodo > 0) {
            console.log(`   └─ Faltan ${faltantesEnPeriodo} empleado(s) con archivos incompletos\n`);
        }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 RESUMEN DE COMPARACIÓN`);
    console.log(`${"=".repeat(80)}`);
    console.log(`✅ Empleados completos: ${totalEncontrados}/${totalRevisados}`);
    console.log(`❌ Empleados con archivos faltantes: ${faltantes.length}`);
    console.log(`${"=".repeat(80)}\n`);

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

    console.log(`\n💾 Auditoría Drive exportada: ${rutaArchivo}`);
    console.log(`❌ CFDIs faltantes: ${faltantes.length}`);
}
