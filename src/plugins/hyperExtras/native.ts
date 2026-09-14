/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { get } from "https";
import { tmpdir } from "os";
import { join } from "path";

import { ocrScript } from "./ocrScript";

let running = false;
export async function recognize(_: unknown, data: string) {
    if (process.platform !== "win32") throw Error("Bu sürümde OCR Windows 10/11 gerektirir.");
    if (running) throw Error("Önceki yazı okuma işleminin bitmesini bekle.");
    if (typeof data !== "string" || data.length > 12 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) throw Error("Geçersiz veya çok büyük görsel.");
    const bytes = Buffer.from(data.slice(data.indexOf(",") + 1), "base64");
    if (bytes.length < 24 || bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a" || bytes.readUInt32BE(16) > 2048 || bytes.readUInt32BE(20) > 2048) throw Error("OCR görseli en fazla 2048 × 2048 olabilir.");
    running = true;
    let directory: string | undefined;
    try {
        directory = await mkdtemp(join(tmpdir(), "hyperdc-ocr-"));
        const file = join(directory, "selection.png"); await writeFile(file, bytes);
        return await new Promise<string>((resolve, reject) => {
            execFile(join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(ocrScript, "utf16le").toString("base64")], {
                windowsHide: true, timeout: 30000, maxBuffer: 512 * 1024, encoding: "utf8", env: { ...process.env, HYPERDC_OCR_FILE: file }
            }, (error, stdout) => error ? reject(Error("Windows yazıyı okuyamadı. Windows dil ayarlarında OCR dil paketinin kurulu olduğunu kontrol et.")) : resolve(stdout.trim()));
        });
    } finally { if (directory) await rm(directory, { recursive: true, force: true }); running = false; }
}
export async function readImage(_: unknown, address: string): Promise<Uint8Array> {
    const url = new URL(address);
    if (url.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname) || url.port || url.username || url.password || !url.pathname.startsWith("/attachments/")) throw Error("Yalnızca Discord ek görselleri desteklenir. Diğer görselleri dosya olarak seç.");
    return new Promise((resolve, reject) => {
        const request = get(url, { headers: { "User-Agent": "HyperDC", Accept: "image/*" } }, response => {
            if (response.statusCode !== 200) { response.resume(); reject(Error("Görsel indirilemedi. Mesajı yeniden açıp dene.")); return; }
            const chunks: Buffer[] = []; let size = 0;
            response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 8 * 1024 * 1024) request.destroy(Error("Görsel 8 MB sınırını aşıyor.")); else chunks.push(chunk); });
            response.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks)))); response.on("error", reject);
        });
        const timeout = setTimeout(() => request.destroy(Error("Görsel indirme zaman aşımı.")), 15000);
        request.on("close", () => clearTimeout(timeout)); request.on("error", reject);
    });
}
