//src/menuEmpresa.js
import inquirer from "inquirer";
import { EMPRESAS } from "./empresas.js";

export async function seleccionarEmpresa() {
    const { empresa } = await inquirer.prompt([
        {
            type: "list",
            name: "empresa",
            message: "Seleccione la empresa:",
            choices: EMPRESAS.map((e) => ({
                name: `${e.nombre} (${e.rfc})`,
                value: e
            }))
        }
    ]);

    return empresa;
}