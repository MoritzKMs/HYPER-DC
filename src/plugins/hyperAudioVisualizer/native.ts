/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { net } from "electron";

export async function readAttachment(_: unknown, address: string): Promise<Uint8Array> {
    const url = new URL(address);
    if (url.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net", "cdn.discord.com"].includes(url.hostname)
        || url.port || url.username || url.password || !url.pathname.startsWith("/attachments/"))
        throw new Error("Yalnızca Discord ek dosyaları analiz edilebilir.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await net.fetch(url.href, { redirect: "error", credentials: "omit", signal: controller.signal });
        if (!response.ok) throw new Error(`MP3 indirilemedi (HTTP ${response.status}). Mesajı yeniden açıp dene.`);
        const limit = 25 * 1024 * 1024;
        if (Number(response.headers.get("content-length")) > limit) throw new Error("Görselleştirici sınırı: 25 MB.");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("MP3 verisi alınamadı.");
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > limit) { await reader.cancel(); throw new Error("Görselleştirici sınırı: 25 MB."); }
            chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return bytes;
    } finally { clearTimeout(timeout); }
}
