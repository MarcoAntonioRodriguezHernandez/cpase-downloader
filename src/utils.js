//src/utils.js
export const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

export function normalizarTexto(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase();
}

export function normalizarRazonSocialFiscal(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/,/g, "")
        .replace(/\./g, "_")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .replace(/_+/g, "_")
        .trim()
        .toLowerCase();
}

export function obtenerBaseFiscal(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/s\.?a\.?\s*de\s*c\.?v\.?/g, "")
        .replace(/[^a-z0-9]/g, "");
}

export function obtenerNombreFiscalCanonico(texto, tipo = "empresa") {
    const base = texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase();

    if (tipo === "empresa") return `${base}_sa_de_cv`;
    if (tipo === "proveedor_puntos") return `${base}_s_a_de_c_v`;

    return base;
}
