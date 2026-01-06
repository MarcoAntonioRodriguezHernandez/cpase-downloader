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

export function normalizarNombreProveedor(razonSocial) {
    let texto = razonSocial
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    // 🔹 Caso S.A. DE C.V. → s_a_de_c_v
    texto = texto.replace(/\bs\.a\. de c\.v\.\b/gi, "s_a_de_c_v");

    // 🔹 Caso SA DE CV → sa_de_cv
    texto = texto.replace(/\bsa de cv\b/gi, "sa_de_cv");

    // 🔹 Limpieza general
    texto = texto
        .replace(/[^a-z0-9\s_]/g, "")
        .replace(/\s+/g, "_");

    return texto;
}
