/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { net } from "electron";

import { libraryUrl, MAX_TRACK_BYTES, readLimited } from "./library";

export async function readLibraryFile(_: unknown, file: string): Promise<Uint8Array> {
    const url = libraryUrl(file);
    const response = await net.fetch(url, { credentials: "omit", redirect: "error", signal: AbortSignal.timeout(60000), cache: "no-store" });
    return readLimited(response, file === "catalog.json" ? 256 * 1024 : MAX_TRACK_BYTES);
}
