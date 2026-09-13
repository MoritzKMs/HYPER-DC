/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import turkish from "./tr.json";

export type HyperLanguage = "tr" | "en";

function readLanguage(): HyperLanguage {
    try {
        return VencordNative.settings.get().plugins?.HyperDCLanguage?.language === "en" ? "en" : "tr";
    } catch {
        return "tr";
    }
}

// Plugin metadata is created during startup, so language changes require a reload.
export const hyperLanguage = readLanguage();

export function hyperTranslate(text: string): string {
    return hyperLanguage === "tr" ? (turkish as Record<string, string>)[text] ?? text : text;
}
