import readline from "readline";
import { EMPRESAS } from "./empresas.js";

export function seleccionarEmpresa() {
    return new Promise((resolve) => {
        console.log("\nSeleccione la empresa:\n");

        EMPRESAS.forEach((e, i) => {
            console.log(
                `  ${i + 1}. ${e.nombre} (${e.rfc})`
            );
        });

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question("\nIngrese el número de la empresa: ", (respuesta) => {
            const index = Number(respuesta) - 1;

            if (!EMPRESAS[index]) {
                console.log("\n❌ Opción inválida\n");
                rl.close();
                process.exit(1);
            }

            rl.close();
            resolve(EMPRESAS[index]);
        });
    });
}
