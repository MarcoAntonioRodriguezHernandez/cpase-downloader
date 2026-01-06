//src/revisionNombres.js
import fs from "fs";
import path from "path";
import { normalizarNombreProveedor } from "./utils.js";

export function revisarNombresProveedores({
                                              proveedores,
                                              baseDir,
                                              empresaNombre,
                                              renombrar = false
                                          }) {
    const rutaEmpresa = path.join(baseDir, empresaNombre);

    if (!fs.existsSync(rutaEmpresa)) {
        console.log("❌ No existe carpeta de empresa");
        return;
    }

    const carpetasExistentes = fs.readdirSync(rutaEmpresa)
        .filter(f => fs.statSync(path.join(rutaEmpresa, f)).isDirectory());

    const resultados = [];

    for (const proveedor of proveedores) {
        const esperado = normalizarNombreProveedor(proveedor.razon_social);

        const encontrado = carpetasExistentes.find(
            c => c === esperado || c.replace(/_+/g, "_") === esperado
        );

        if (!encontrado) {
            const posible = carpetasExistentes.find(c =>
                c.includes(esperado.split("_")[0])
            );

            resultados.push({
                rfc: proveedor.rfc,
                razonSocial: proveedor.razon_social,
                esperado,
                actual: posible || null
            });

            if (renombrar && posible) {
                fs.renameSync(
                    path.join(rutaEmpresa, posible),
                    path.join(rutaEmpresa, esperado)
                );

                console.log(`✏️  RENOMBRADO: ${posible} → ${esperado}`);
            }
        }
    }

    return resultados;
}
