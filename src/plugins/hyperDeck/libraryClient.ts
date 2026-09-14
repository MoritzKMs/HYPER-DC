/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { PluginNative } from "@utils/types";

import { LibraryTrack, libraryUrl, MAX_TRACK_BYTES, readLimited, validateLibrary } from "./library";

async function read(file: string): Promise<Uint8Array> {
    if (IS_DISCORD_DESKTOP) {
        const native = VencordNative.pluginHelpers.HyperDeck as PluginNative<typeof import("./native")>;
        return new Uint8Array(await native.readLibraryFile(file));
    }
    return readLimited(await fetch(libraryUrl(file), { credentials: "omit", signal: AbortSignal.timeout(60000), cache: "no-store" }), file === "catalog.json" ? 256 * 1024 : MAX_TRACK_BYTES);
}

let catalog: LibraryTrack[] | undefined;
let catalogTime = 0;
let catalogRequest: Promise<LibraryTrack[]> | undefined;
export async function loadLibrary(): Promise<LibraryTrack[]> {
    if (catalog && Date.now() - catalogTime < 5 * 60000) return catalog;
    return catalogRequest ??= read("catalog.json").then(bytes => {
        catalog = validateLibrary(JSON.parse(new TextDecoder().decode(bytes)));
        catalogTime = Date.now();
        return catalog;
    }).finally(() => { catalogRequest = undefined; });
}

const cacheKey = "HyperDeck:MusicCache:v1";
const maxCache = 128 * 1024 * 1024;
let downloadQueue: Promise<unknown> = Promise.resolve();

export async function downloadTrack(track: LibraryTrack): Promise<File> {
    const job = downloadQueue.then(async () => {
        const key = track.sha ? `${track.file}:${track.sha}` : "";
        let cache: { key: string; bytes: Uint8Array; }[] = [];
        try { cache = await DataStore.get(cacheKey) ?? []; } catch { }
        const hit = key && cache.find(entry => entry.key === key && entry.bytes.length === track.bytes);
        const bytes = hit ? hit.bytes : await read(track.file);
        if (bytes.length !== track.bytes) throw new Error("Incomplete music download");
        if (key && !hit) {
            cache = [{ key, bytes }, ...cache.filter(entry => entry.key !== key)];
            let total = 0;
            cache = cache.filter(entry => (total += entry.bytes.length) <= maxCache);
            try { await DataStore.set(cacheKey, cache); } catch { /* Playback can continue if disk quota is full. */ }
        }
        return new File([bytes.buffer as ArrayBuffer], track.file, { type: "audio/mpeg" });
    });
    downloadQueue = job.catch(() => {});
    return job;
}
