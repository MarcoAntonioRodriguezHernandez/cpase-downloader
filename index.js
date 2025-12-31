import axios from "axios";
import path from "path";
import { descargarCFDISProveedor } from "./src/descargas.js";
import {logEmpresa, logFinEmpresa, logFinProveedor, logProveedor} from "./src/logger.js";
import {seleccionarEmpresa} from "./src/menuEmpresa.js";
import { debeEjecutar } from "./src/resume.js";

// const EMPRESA_ID = "62660";
// const RFC_EMPRESA = "SEP100422AB7";
// const NOMBRE_EMPRESA = "Servicios de Extraccion Petrolera Lifting de Mexico SA de CV";

const BASE_DIR = path.resolve("./documentos/cotemar");

/* ======================================================
    MODO DE EJECUCIÓN
    Configurar el modo de ejecución a continuación
    ====================================================== */

const MODO_EJECUCION = {
    tipo: "TODOS",
    // "TODOS" | "UN_PROVEEDOR"

    proveedorRFC: null, // requerido si tipo === "UN_PROVEEDOR"
    año: null,          // opcional
    mes: null           // opcional (0-11)
};

function filtrarProveedores(proveedores, modo) {
    if (modo.tipo === "UN_PROVEEDOR") {
        return proveedores.filter(
            p => p.rfc === modo.proveedorRFC
        );
    }
    return proveedores;
}

function obtenerAños(modo) {
    if (modo.año !== null) return [modo.año];
    return AÑOS;
}

function obtenerPeriodos(modo) {
    if (modo.mes !== null) return [modo.mes];
    return PERIODOS;
}


/* ======================================================
    IMPORTANTE, REANUDACION DE DESCARGAS OPCIONAL
    Si se desea reanudar descargas, llenar los datos a continuación
    De lo contrario, dejar el objeto RESUME con sus atributos como null
    ====================================================== */
const RESUME = {
    proveedorRFC: "RORA4705033Q7", // ALEJANDRO RODRIGUEZ REYES
    año: 2023,
    mes: 6 // julio (0-based)
};


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
    "PHPSESSID=uas3vlkpskg2ku5hf3tchufn8n; state=e352107d032c4731a7782a4a58d57763";

async function obtenerProveedores(empresaId) {
    const { data } = await client.post(
        "/proveedor/dashboard/services/pagination.php",
        { empresa: empresaId, estatus: 1 }
    );
    return data.data.items;
}

async function ejecutar() {
    const inicioEmpresa = Date.now(); // ⏱️ Inicio del proceso completo
    const empresa = await seleccionarEmpresa();

    const EMPRESA_ID = empresa.empresa_id;
    const RFC_EMPRESA = empresa.rfc;
    const NOMBRE_EMPRESA = empresa.nombre;

    logEmpresa(NOMBRE_EMPRESA);

    const proveedores = await obtenerProveedores(EMPRESA_ID);
    const proveedoresFiltrados = filtrarProveedores(proveedores, MODO_EJECUCION);
    const años = obtenerAños(MODO_EJECUCION);
    const periodos = obtenerPeriodos(MODO_EJECUCION);

    for (const proveedor of proveedoresFiltrados) {
        const inicioProveedor = Date.now(); // ⏱️ Inicio del proveedor
        logProveedor(proveedor.razon_social, proveedor.rfc);

        for (const año of años) {
            for (const periodo of periodos) {
                if (!debeEjecutar({
                    proveedor,
                    año,
                    periodo,
                    resume: RESUME
                })) {
                    continue;
                }

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
        const tiempoProveedor = ((Date.now() - inicioProveedor) / 1000).toFixed(2);
        logFinProveedor(proveedor.razon_social, tiempoProveedor);
    }
    const tiempoTotal = ((Date.now() - inicioEmpresa) / 1000).toFixed(2);
    logFinEmpresa(NOMBRE_EMPRESA, tiempoTotal);
}

ejecutar().catch(console.error);
