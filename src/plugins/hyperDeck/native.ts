/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get } from "https";

import { libraryUrl, MAX_TRACK_BYTES } from "./library";

export async function readLibraryFile(_: unknown, file: string): Promise<Uint8Array> {
    const url = libraryUrl(file);
    return new Promise((resolve, reject) => {
        const request = get(url, { headers: { "User-Agent": "HyperDC-Music", Accept: "application/vnd.github+json" } }, response => {
            if (response.statusCode !== 200) { response.resume(); reject(Error(`GitHub HTTP ${response.statusCode}`)); return; }
            const chunks: Buffer[] = [];
            let size = 0;
            const started = Date.now();
            let timer: ReturnType<typeof setTimeout>;
            response.on("data", (chunk: Buffer) => {
                size += chunk.length;
                if (size > (file === "catalog.json" ? 256 * 1024 : MAX_TRACK_BYTES)) { response.destroy(Error("Music download exceeds size limit")); return; }
                chunks.push(chunk);
                if (file !== "catalog.json") {
                    const delay = size / (256 * 1024) * 1000 - (Date.now() - started);
                    if (delay > 0) { response.pause(); timer = setTimeout(() => response.resume(), delay); }
                }
            });
            response.on("end", () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
            response.on("error", error => { clearTimeout(timer); reject(error); });
            response.on("close", () => clearTimeout(timer));
        });
        request.setTimeout(30000, () => request.destroy(Error("Music download timed out")));
        request.on("error", reject);
    });
}
