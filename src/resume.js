// src/resume.js

/**
 * Determina si debe ejecutarse según configuración RESUME
 * @param {Object} params
 * @param {Object} params.proveedor - Proveedor actual
 * @param {number} params.año - Año actual
 * @param {number} params.periodo - Período (mes) actual
 * @param {Object} params.resume - Configuración de reanudación
 * @returns {boolean} - true si debe ejecutarse
 */
export function debeEjecutar({ proveedor, año, periodo, resume }) {
    // Sin configuración → ejecutar todo
    if (!resume.proveedorRFC && resume.año === null && resume.mes === null) {
        return true;
    }

    // Filtrar por RFC de proveedor (si está configurado)
    if (resume.proveedorRFC && proveedor.rfc !== resume.proveedorRFC) {
        return false;
    }

    // Filtrar por año (si está configurado)
    if (resume.año !== null && año < resume.año) {
        return false;
    }

    // Filtrar por mes (solo si estamos en el año objetivo)
    if (resume.año !== null && año === resume.año && resume.mes !== null && periodo < resume.mes) {
        return false;
    }

    return true;
}