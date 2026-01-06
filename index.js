import axios from "axios";
import path from "path";
import { descargarCFDISProveedor } from "./src/descargas.js";
import {logEmpresa, logFinEmpresa, logFinProveedor, logProveedor} from "./src/logger.js";
import {seleccionarEmpresa} from "./src/menuEmpresa.js";
import { debeEjecutar } from "./src/resume.js";

/* ======================================================
    CONFIGURACIÓN GLOBAL
    ====================================================== */

// Directorio base donde se guardarán todos los documentos descargados
const BASE_DIR = path.resolve("./documentos/cotemar");

/* ======================================================
    MODO DE EJECUCIÓN
    Configurar el modo de ejecución a continuación
    ====================================================== */

const MODO_EJECUCION = {
    // Tipo de ejecución:
    // "TODOS" - descarga todos los proveedores
    // "UN_PROVEEDOR" - descarga solo un proveedor específico
    // "LISTA_PROVEEDORES" - descarga solo los proveedores de la lista
    // "REVISION_NOMBRES" - revisa nombres de carpetas sin descargar
    tipo: "REVISION_NOMBRES",

    proveedorRFC: null, // requerido si tipo === "UN_PROVEEDOR"
    listaProveedoresRFC: [        // requerido si tipo === "LISTA_PROVEEDORES"
        "SPA961227MPA",
        "SSI090128RP0",
        "STI960112955",
        "SDO120424M87",
        "SSU120314L85",
        "SST151113BB2",
        "SSE131212C67",
        "SIM1710305W4",
    ],
    año: null,          // opcional
    mes: null           // opcional (0-11)
};

/**
 * Filtra la lista de proveedores según el modo de ejecución
 * @param {Array} proveedores - Lista completa de proveedores
 * @param {Object} modo - Configuración del modo de ejecución
 * @returns {Array} - Proveedores filtrados
 */
function filtrarProveedores(proveedores, modo) {
    if (modo.tipo === "UN_PROVEEDOR") {
        // Retorna solo el proveedor que coincida con el RFC especificado
        return proveedores.filter(
            p => p.rfc === modo.proveedorRFC
        );
    }
    if (modo.tipo === "LISTA_PROVEEDORES") {
        // Retorna solo los proveedores que estén en la lista de RFCs
        return proveedores.filter(
            p => modo.listaProveedoresRFC.includes(p.rfc)
        );
    }
    // Retorna todos los proveedores
    return proveedores;
}

/**
 * Obtiene los años a procesar según el modo de ejecución
 * @param {Object} modo - Configuración del modo de ejecución
 * @returns {Array} - Lista de años a procesar
 */
function obtenerAños(modo) {
    // Si se especificó un año, procesar solo ese año
    if (modo.año !== null) return [modo.año];
    // Si no, procesar todos los años configurados
    return AÑOS;
}

/**
 * Obtiene los períodos (meses) a procesar según el modo de ejecución
 * @param {Object} modo - Configuración del modo de ejecución
 * @returns {Array} - Lista de períodos (0-11) a procesar
 */
function obtenerPeriodos(modo) {
    // Si se especificó un mes, procesar solo ese mes
    if (modo.mes !== null) return [modo.mes];
    // Si no, procesar todos los meses del año
    return PERIODOS;
}

/* ======================================================
    CONFIGURACIÓN DE REANUDACIÓN
    Permite continuar desde un punto específico si hubo
    una interrupción en el proceso
    ====================================================== */
const RESUME = {
    // RFC del proveedor desde donde reanudar (null = no reanudar)
    proveedorRFC: "SSE131212C67", // ALEJANDRO RODRIGUEZ REYES
    año: 2024,
    mes: 4 // julio (0-based)
};

/* ======================================================
    CONFIGURACIÓN DE PERÍODOS A PROCESAR
    ====================================================== */

const AÑOS = [2021, 2022, 2023, 2024, 2025];
const PERIODOS = [...Array(12).keys()]; // 0-11

/* ======================================================
    CLIENTE HTTP CONFIGURADO
    Instancia de Axios con configuración específica para
    conectarse a la plataforma CPASE
    ====================================================== */

const client = axios.create({
    baseURL: "https://cpase.cpavision.mx",
    withCredentials: true,
    headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer":
            "https://cpase.cpavision.mx/proveedor/dashboard/proveedoresMes/index.php?emp=62660"
    }
});

// Cookie de sesión necesaria para autenticación
// IMPORTANTE: Esta cookie debe estar activa/válida
client.defaults.headers.Cookie =
    "PHPSESSID=ima6u3052e0dgb732v8spp06qh; state=13b3b6873a894813b2087230b630d862";

/* ======================================================
    FUNCIÓN PARA OBTENER PROVEEDORES
    ====================================================== */

/**
 * Obtiene la lista de proveedores activos de una empresa
 * @param {string} empresaId - ID de la empresa en el sistema
 * @returns {Promise<Array>} - Lista de proveedores
 */
async function obtenerProveedores(empresaId) {
    const { data } = await client.post(
        "/proveedor/dashboard/services/pagination.php",
        { empresa: empresaId, estatus: 1 }
    );
    // Extraer los proveedores de la respuesta
    return data.data.items;
}

/* ======================================================
    FUNCIÓN PRINCIPAL DE EJECUCIÓN
    Orquesta todo el proceso de descarga
    ====================================================== */

async function ejecutar() {
    const inicioEmpresa = Date.now(); // ⏱️ Inicio del proceso completo
    const empresa = await seleccionarEmpresa();

    const EMPRESA_ID = empresa.empresa_id;
    const RFC_EMPRESA = empresa.rfc;
    const NOMBRE_EMPRESA = empresa.nombre;

    logEmpresa(NOMBRE_EMPRESA);

    // 🔍 Obtener lista de proveedores de esta empresa
    const proveedores = await obtenerProveedores(EMPRESA_ID);
    // Aplicar filtros según modo de ejecución
    const proveedoresFiltrados = filtrarProveedores(proveedores, MODO_EJECUCION);
    const años = obtenerAños(MODO_EJECUCION);
    const periodos = obtenerPeriodos(MODO_EJECUCION);

    // ♻️ ITERAR SOBRE CADA PROVEEDOR
    for (const proveedor of proveedoresFiltrados) {
        const inicioProveedor = Date.now(); // ⏱️ Inicio del proveedor
        logProveedor(proveedor.razon_social, proveedor.rfc);

        for (const año of años) {
            for (const periodo of periodos) {
                // ⚙️ Verificar si debe ejecutarse según configuración RESUME
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

/* ======================================================
    INICIO DEL PROGRAMA
    ====================================================== */

// Ejecutar función principal y capturar errores no manejados
ejecutar().catch(console.error);
