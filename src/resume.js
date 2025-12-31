export function debeEjecutar({
                                 proveedor,
                                 año,
                                 periodo,
                                 resume
                             }) {
    // 1️⃣ Proveedor
    if (resume.proveedorRFC) {
        if (proveedor.rfc < resume.proveedorRFC) return false;
        if (proveedor.rfc > resume.proveedorRFC) {
            resume.proveedorRFC = null;
            resume.año = null;
            resume.mes = null;
        }
    }

    // 2️⃣ Año
    if (resume.año !== null) {
        if (año < resume.año) return false;
        if (año > resume.año) {
            resume.año = null;
            resume.mes = null;
        }
    }

    // 3️⃣ Mes
    if (resume.mes !== null) {
        if (periodo < resume.mes) return false;
        if (periodo > resume.mes) {
            resume.mes = null;
        }
    }

    return true;
}
