import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import os from "os";

export async function descargarXMLConPuppeteer(url, outputPath, cookies) {
    // 📁 Directorio temporal único por descarga
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "cpase-download-")
    );

    const browser = await puppeteer.launch({
        headless: "new"
    });

    const page = await browser.newPage();

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    if (cookies?.length) {
        await page.setCookie(...cookies);
    }

    // 🔥 Habilitar descargas reales en Chromium
    const cdp = await page.target().createCDPSession();
    await cdp.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: tempDir
    });

    // 🚫 No esperar navegación normal (ERR_ABORTED es esperado)
    try {
        await page.goto(url, { waitUntil: "load", timeout: 0 });
    } catch {
        // Ignorado a propósito
    }

    // ⏳ Esperar archivo descargado (polling real)
    let downloadedFile;
    for (let i = 0; i < 30; i++) {
        const files = fs.readdirSync(tempDir)
            .filter(f => !f.endsWith(".crdownload"));

        if (files.length) {
            downloadedFile = path.join(tempDir, files[0]);
            break;
        }

        await new Promise(r => setTimeout(r, 300));
    }

    if (!downloadedFile) {
        await browser.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw new Error("No se descargó ningún archivo");
    }

    // 🧠 LÓGICA CLAVE:
    // El XML PROCESADO a veces viene con headers incorrectos
    const buffer = fs.readFileSync(downloadedFile);
    const text = buffer.toString("utf8").trim();

    if (text.startsWith("<")) {
        // ✅ Es XML real → forzar extensión correcta
        fs.writeFileSync(outputPath, buffer);
        fs.unlinkSync(downloadedFile);
    } else {
        // 📦 No es XML → mover tal cual
        fs.renameSync(downloadedFile, outputPath);
    }

    await browser.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
}
