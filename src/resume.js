let resumeActivo = false;

export function debeEjecutar({ proveedor, año, periodo, resume }) {

    // 🟢 Si no hay resume configurado → ejecutar todo
    if (!resume.proveedorRFC && resume.año === null && resume.mes === null) {
        return true;
    }

    // 🟢 Si ya pasamos el punto de reanudación
    if (resumeActivo) {
        return true;
    }

    // 1️⃣ Proveedor
    if (proveedor.rfc !== resume.proveedorRFC) {
        return false;
    }

    // 2️⃣ Año
    if (año !== resume.año) {
        return false;
    }

    // 3️⃣ Mes
    if (periodo !== resume.mes) {
        return false;
    }

    // 🟢 EXACTO punto encontrado → activar ejecución
    resumeActivo = true;
    return true;
}
