import axios from "axios";
import path from "path";
import { descargarCFDISProveedor } from "./src/descargas.js";

const EMPRESA_ID = "62660";
const RFC_EMPRESA = "SEP100422AB7";
const NOMBRE_EMPRESA = "Servicios de Extraccion Petrolera Lifting de Mexico SA de CV";

const BASE_DIR = path.resolve("./documentos/cotemar");

const AÑOS = [2021, 2022, 2023, 2024, 2025];
const PERIODOS = [...Array(12).keys()]; // 0-11

const client = axios.create({
    baseURL: "https://cpase.cpavision.mx",
    withCredentials: true,
    headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer":
            "https://cpase.cpavision.mx/proveedor/dashboard/proveedoresMes/index.php?emp=62660"
    }
});

client.defaults.headers.Cookie =
    "PHPSESSID=uas3vlkpskg2ku5hf3tchufn8n; state=c0fd5770fd694470bd1c776a7d879373";

async function obtenerProveedores() {
    const { data } = await client.post(
        "/proveedor/dashboard/services/pagination.php",
        { empresa: EMPRESA_ID, estatus: 1 }
    );
    return data.data.items;
}

async function ejecutar() {
    const proveedores = await obtenerProveedores();

    for (const proveedor of proveedores) {
        for (const año of AÑOS) {
            for (const periodo of PERIODOS) {
                await descargarCFDISProveedor({
                    client,
                    proveedor,
                    año,
                    periodo,
                    EMPRESA_ID,
                    RFC_EMPRESA,
                    NOMBRE_EMPRESA,
                    BASE_DIR
                });
            }
        }
    }
}

ejecutar().catch(console.error);
