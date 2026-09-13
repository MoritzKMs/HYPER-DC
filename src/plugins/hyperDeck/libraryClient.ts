/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";

import { LibraryTrack, libraryUrl, MAX_TRACK_BYTES, readLimited, validateLibrary } from "./library";

async function read(file: string): Promise<Uint8Array> {
    if (IS_DISCORD_DESKTOP) {
        const native = VencordNative.pluginHelpers.HyperDeck as PluginNative<typeof import("./native")>;
        return new Uint8Array(await native.readLibraryFile(file));
    }
    return readLimited(await fetch(libraryUrl(file), { credentials: "omit", signal: AbortSignal.timeout(60000), cache: "no-store" }), file === "catalog.json" ? 256 * 1024 : MAX_TRACK_BYTES);
}

export async function loadLibrary(): Promise<LibraryTrack[]> {
    return validateLibrary(JSON.parse(new TextDecoder().decode(await read("catalog.json"))));
}

export async function downloadTrack(track: LibraryTrack): Promise<File> {
    const bytes = await read(track.file);
    if (bytes.length !== track.bytes) throw new Error("Incomplete music download");
    return new File([bytes.buffer as ArrayBuffer], track.file, { type: "audio/mpeg" });
}
