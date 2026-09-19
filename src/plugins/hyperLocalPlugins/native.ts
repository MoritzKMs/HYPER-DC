/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR } from "@main/utils/constants";
import { createHash } from "crypto";
import { shell } from "electron";
import { lstat, mkdir, open, readdir, realpath } from "fs/promises";
import { join } from "path";

const directory = join(DATA_DIR, "local-plugins");
const validName = (name: string) => /^[\w .-]+\.plugin\.js$/.test(name) && !name.includes("..") && name.length <= 128;
async function folder() {
    await mkdir(directory, { recursive: true });
    if ((await lstat(directory)).isSymbolicLink()) throw Error("Eklenti klasörü bir bağlantı olamaz.");
    return directory;
}
export async function list() {
    const path = await folder();
    const files = (await readdir(path, { withFileTypes: true })).filter(f => f.isFile() && validName(f.name)).map(f => f.name).sort().slice(0, 200);
    return { path, files };
}
export async function read(_: unknown, name: string) {
    if (typeof name !== "string" || !validName(name)) throw Error("Geçersiz eklenti dosyası adı.");
    const path = join(await folder(), name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024 || await realpath(path) !== path) throw Error("Eklenti normal bir dosya olmalı ve 512 KB sınırını aşmamalı.");
    const handle = await open(path, "r");
    try {
        const current = await handle.stat();
        if (!current.isFile() || current.ino !== stat.ino || current.dev !== stat.dev) throw Error("Dosya okuma sırasında değişti.");
        const buffer = Buffer.alloc(512 * 1024 + 1);
        let length = 0;
        while (length < buffer.length) {
            const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
            if (!bytesRead) break;
            length += bytesRead;
        }
        if (length > 512 * 1024) throw Error("Eklenti 512 KB sınırını aşmamalı.");
        const code = buffer.subarray(0, length).toString("utf8");
        return { code, hash: createHash("sha256").update(code).digest("hex") };
    } finally { await handle.close(); }
}
export async function openFolder() { const error = await shell.openPath(await folder()); if (error) throw Error(error); }
