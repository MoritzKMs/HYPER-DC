/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const owners = new Set<object>();
export function claimHyperMicrophone(owner: object) {
    if (owners.size && !owners.has(owner)) throw Error("Mikrofon başka bir HyperDC ses aracında açık. Önce HyperDeck mikrofon karışımını veya HyperVoice efektini kapat.");
    owners.add(owner);
}
export function releaseHyperMicrophone(owner: object) { owners.delete(owner); }
