/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const LIBRARY_BASE = "https://raw.githubusercontent.com/MoritzKMs/HYPER-DC/main/music/";
export const MAX_TRACK_BYTES = 25 * 1024 * 1024;

export interface LibraryTrack { title: string; file: string; bytes: number; }
export const LIBRARY_INDEX = "https://api.github.com/repos/MoritzKMs/HYPER-DC/contents/music?ref=main";

export function validMusicFile(file: string) {
    return file.length <= 240 && !/[\\/\x00-\x1f]/.test(file) && /\.mp3$/i.test(file) && file !== ".mp3";
}

export function validateLibrary(data: unknown): LibraryTrack[] {
    if (!Array.isArray(data) || data.length > 1000) throw new Error("Invalid music directory");
    return data.filter(item => item?.type === "file" && typeof item.name === "string" && validMusicFile(item.name)
        && Number.isInteger(item.size) && item.size > 0 && item.size <= MAX_TRACK_BYTES)
        .map(item => ({ title: item.name.replace(/\.mp3$/i, ""), file: item.name, bytes: item.size }))
        .sort((a, b) => a.title.localeCompare(b.title, "tr"));
}

export function libraryUrl(file: string) {
    if (file === "catalog.json") return LIBRARY_INDEX;
    if (!validMusicFile(file)) throw new Error("Invalid music file");
    return LIBRARY_BASE + encodeURIComponent(file);
}

export async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > limit) throw new Error("Music download exceeds size limit");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty music response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) { await reader.cancel(); throw new Error("Music download exceeds size limit"); }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
}
