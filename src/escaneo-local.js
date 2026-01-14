// src/escaneo-local.js
import fs from "fs";
import path from "path";

/**
 * Escanea archivos XML en una ruta local siguiendo la estructura de carpetas
 * @param {string} baseDir - Directorio raíz (ej: C:/Users/marco/Documents/cotemar)
 * @param {Array<string>} rutaEsperada - Ruta de carpetas a seguir
 * @returns {Array} - Lista de archivos XML encontrados
 */
export function escanearCarpetaLocal(baseDir, rutaEsperada) {
    const rutaCompleta = path.join(baseDir, ...rutaEsperada);

    if (!fs.existsSync(rutaCompleta)) {
        return [];
    }

    return fs.readdirSync(rutaCompleta)
        .filter(nombre => {
            const ext = path.extname(nombre).toLowerCase();
            return ['.pdf', '.xml'].includes(ext);
        })
        .map(nombre => ({
            nombre,
            ruta: rutaCompleta
        }));
}