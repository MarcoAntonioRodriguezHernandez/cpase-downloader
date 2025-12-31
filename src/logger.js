export function logEmpresa(nombre) {
    console.log(`\n[EMPRESA] ${nombre}`);
}

export function logProveedor(nombre, rfc) {
    console.log(`  └─▶ [PROVEEDOR] ${nombre} (${rfc})`);
}

export function logPeriodo(año, mes) {
    console.log(`       └─▶ [PERIODO] ${año} / ${mes}`);
}

export function logCFDI(nombreBase, indice) {
    console.log(`            ├─ CFDI: ${nombreBase}_${indice} ✔`);
}

export function logSinDatos() {
    console.log(`            └─ Sin CFDIs`);
}

export function logError(contexto, error) {
    console.error(`❌ [ERROR] ${contexto}`);
    console.error(error?.message ?? error);
}
