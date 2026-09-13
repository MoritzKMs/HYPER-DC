/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR } from "@main/utils/constants";
import { randomUUID } from "crypto";
import { app } from "electron";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { get } from "https";
import { basename, dirname, join } from "path";

import { decodePackage, newerVersion } from "./package";
import { HYPER_VERSION } from "./version";

const repo = "https://api.github.com/repos/MoritzKMs/HYPER-DC";
const assetName = "HyperDC-update.json";
const statePath = join(DATA_DIR, "update-state.json");
let busy = false;

function safePath(target: string) {
    for (let dir = target; ; dir = dirname(dir)) {
        if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw Error("Bağlantılı güncelleme yolu desteklenmiyor.");
        if (dirname(dir) === dir) break;
    }
}
function state() {
    safePath(statePath);
    if (!existsSync(statePath)) throw Error("Bu özellik için 0.4.0 veya sonraki kurucuyu bir kez mevcut kurulumun üzerine yükleyin.");
    return JSON.parse(readFileSync(statePath, "utf8"));
}
function save(value: unknown) {
    safePath(statePath + ".tmp");
    writeFileSync(statePath + ".tmp", JSON.stringify(value));
    renameSync(statePath + ".tmp", statePath);
}
function download(address: string, limit: number, redirects = 0): Promise<Buffer> {
    const url = new URL(address);
    if (url.protocol !== "https:" || !["api.github.com", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(url.hostname))
        return Promise.reject(Error("Geçersiz güncelleme adresi."));
    return new Promise((resolve, reject) => {
        const request = get(url, { headers: { "User-Agent": "HyperDC-Updater", Accept: "application/vnd.github+json" } }, response => {
            if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
                response.resume();
                if (!response.headers.location || redirects >= 5) { reject(Error("Güncelleme yönlendirmesi başarısız.")); return; }
                download(new URL(response.headers.location, url).href, limit, redirects + 1).then(resolve, reject);
                return;
            }
            if (response.statusCode !== 200) { response.resume(); reject(Error(`GitHub yanıtı: ${response.statusCode}`)); return; }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", chunk => {
                size += chunk.length;
                if (size > limit) { response.destroy(Error("Güncelleme boyutu sınırı aşıldı.")); return; }
                chunks.push(chunk);
            });
            response.on("end", () => resolve(Buffer.concat(chunks)));
            response.on("error", reject);
        });
        request.setTimeout(60000, () => request.destroy(Error("Güncelleme isteği zaman aşımına uğradı.")));
        request.on("error", reject);
    });
}
async function latest() {
    const release = JSON.parse((await download(repo + "/releases/latest", 1024 * 1024)).toString("utf8"));
    const version = String(release.tag_name).replace(/^v/, "");
    if (release.draft || release.prerelease || !/^\d+\.\d+\.\d+$/.test(version)) throw Error("Geçerli yayın bulunamadı.");
    const asset = release.assets?.find(a => a.name === assetName);
    return { version, asset };
}
export async function check() {
    const info = await latest();
    const s = state();
    return { current: HYPER_VERSION, latest: info.version, available: newerVersion(info.version, HYPER_VERSION) && !!info.asset, pending: !!s.pending, rolledBack: !!s.rolledBack };
}
export async function installUpdate() {
    if (busy) throw Error("Güncelleme zaten sürüyor.");
    busy = true;
    try {
        const s = state();
        if (s.pending) throw Error("İndirilen güncellemeyi uygulamak için yeniden başlatın.");
        const { version, asset } = await latest();
        if (!newerVersion(version, HYPER_VERSION) || !asset) throw Error("Yeni güncelleme paketi bulunamadı.");
        if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest) || !Number.isInteger(asset.size) || asset.size > 45 * 1024 * 1024
            || asset.browser_download_url !== `https://github.com/MoritzKMs/HYPER-DC/releases/download/v${version}/${assetName}`) throw Error("Yayın paketi doğrulanamıyor.");
        const bytes = await download(asset.browser_download_url, 45 * 1024 * 1024);
        if (bytes.length !== asset.size) throw Error("Güncelleme indirmesi eksik.");
        const digest = asset.digest.slice(7);
        const files = decodePackage(bytes, version, digest);
        const build = `${version}-${digest.slice(0, 12)}`;
        const target = join(DATA_DIR, "builds", build);
        safePath(target);
        if (existsSync(target)) {
            for (const [name, data] of Object.entries(files)) {
                safePath(join(target, name));
                if (!readFileSync(join(target, name)).equals(data)) throw Error("Mevcut güncelleme dosyaları uyuşmuyor. Kurucuyla onarım yapın.");
            }
        } else {
            const staging = target + ".staging-" + randomUUID();
            mkdirSync(staging, { recursive: true });
            for (const [name, data] of Object.entries(files)) writeFileSync(join(staging, name), data, { flag: "wx" });
            renameSync(staging, target);
        }
        save({ current: build, previous: s.current, pending: true, attempted: false, rolledBack: false });
        return version;
    } finally { busy = false; }
}
export function confirmStartup() {
    const s = state();
    if (s.pending && s.current === basename(__dirname)) save({ ...s, pending: false, attempted: false });
}
export function restart() { app.relaunch(); app.exit(0); }
