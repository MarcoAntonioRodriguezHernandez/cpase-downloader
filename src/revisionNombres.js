import fs from "fs";
import path from "path";
import { obtenerBaseFiscal } from "./utils.js";

export async function revisarONombrarProveedores({
                                                     proveedores, // compatibilidad
                                                     BASE_DIR,
                                                     accion
                                                 }) {
    const resultados = [];

    if (!fs.existsSync(BASE_DIR)) return resultados;

    const carpetas = fs.readdirSync(BASE_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    const mapaFiscal = {};

    for (const carpeta of carpetas) {
        const key = obtenerBaseFiscal(carpeta);
        mapaFiscal[key] ??= [];
        mapaFiscal[key].push(carpeta);
    }

    for (const [baseFiscal, carpetasEquivalentes] of Object.entries(mapaFiscal)) {
        if (carpetasEquivalentes.length <= 1) continue;

        const carpetaCanonica =
            carpetasEquivalentes.find(c => c.endsWith("_sa_de_cv"))
            ?? carpetasEquivalentes[0];

        resultados.push({
            base_fiscal: baseFiscal,
            carpetas_detectadas: carpetasEquivalentes.join(", "),
            carpeta_final: carpetaCanonica,
            accion: accion === "RENOMBRAR" ? "UNIFICAR" : "SE UNIFICARÁ"
        });

        if (accion !== "RENOMBRAR") continue;

        const rutaCanonica = path.join(BASE_DIR, carpetaCanonica);

        for (const carpeta of carpetasEquivalentes) {
            if (carpeta === carpetaCanonica) continue;

            const rutaDuplicada = path.join(BASE_DIR, carpeta);

            copiarRecursivo(rutaDuplicada, rutaCanonica);

            // 🔥 eliminar SOLO la raíz duplicada
            fs.rmSync(rutaDuplicada, { recursive: true, force: true });
        }
    }

    return resultados;
}

/**
 * COPIA recursiva segura con preservación total
 * - Nunca sobrescribe archivos existentes
 * - Renombra duplicados con timestamp
 * - Fusiona carpetas sin pérdida
 */
function copiarRecursivo(origen, destino) {
    // Solo crear si NO existe (preserva contenido previo)
    if (!fs.existsSync(destino)) {
        fs.mkdirSync(destino, { recursive: true });
    }

    for (const item of fs.readdirSync(origen)) {
        const src = path.join(origen, item);
        const dst = path.join(destino, item);

        const stat = fs.statSync(src);

        if (stat.isDirectory()) {
            // Fusión recursiva: el destino puede existir con contenido

            copiarRecursivo(src, dst);
        } else {
            // Solo archivos: evitar sobrescritura
            if (!fs.existsSync(dst)) {
                fs.copyFileSync(src, dst);
            } else {
                // Comparar contenido antes de duplicar
                const srcBuffer = fs.readFileSync(src);
                const dstBuffer = fs.readFileSync(dst);

                if (!srcBuffer.equals(dstBuffer)) {
                    // Archivos diferentes: crear copia con timestamp
                    const ext = path.extname(item);
                    const base = path.basename(item, ext);
                    const nuevo = `${base}_duplicado_${Date.now()}${ext}`;

                    fs.copyFileSync(src, path.join(destino, nuevo));
                    console.log(`⚠️  Duplicado guardado: ${nuevo}`);
                }
                // Si son idénticos, no hace nada
            }
        }
    }
}
