/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "crypto";

export const REQUIRED_FILES = ["patcher.js", "preload.js", "renderer.js", "renderer.css"];
const allowedFile = /^(?:(?:patcher|preload|renderer|vencordDesktopMain|vencordDesktopPreload|vencordDesktopRenderer)\.(?:js|css)(?:\.LEGAL\.txt)?|LICENSE)$/;

export function newerVersion(candidate: string, current: string) {
    if (!/^\d+\.\d+\.\d+$/.test(candidate) || !/^\d+\.\d+\.\d+$/.test(current)) return false;
    const a = candidate.split(".").map(Number), b = current.split(".").map(Number);
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
}

export function decodePackage(bytes: Buffer, expectedVersion: string, expectedDigest: string) {
    if (!/^[a-f0-9]{64}$/.test(expectedDigest) || createHash("sha256").update(bytes).digest("hex") !== expectedDigest)
        throw Error("Güncelleme paketi doğrulanamadı.");
    const data = JSON.parse(bytes.toString("utf8"));
    if (data.format !== 1 || data.version !== expectedVersion || data.minLoader !== 1 || !data.files || typeof data.files !== "object")
        throw Error("Uyumsuz güncelleme paketi.");
    const files: Record<string, Buffer> = {};
    let total = 0;
    for (const [name, file] of Object.entries(data.files) as [string, { base64: string; sha256: string; }][]) {
        if (!allowedFile.test(name) || !file || typeof file.base64 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error("Geçersiz paket dosyası.");
        const content = Buffer.from(file.base64, "base64");
        total += content.length;
        if (total > 30 * 1024 * 1024 || createHash("sha256").update(content).digest("hex") !== file.sha256) throw Error("Paket dosyası doğrulanamadı.");
        files[name] = content;
    }
    if (REQUIRED_FILES.some(name => !files[name]?.length)) throw Error("Güncelleme paketi eksik.");
    return files;
}
