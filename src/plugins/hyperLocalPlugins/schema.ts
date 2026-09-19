/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type Control = { id: string; type: "text" | "textarea" | "checkbox" | "button"; label: string; };
export function parseControls(json: string): Control[] {
    if (json.length > 8000) throw Error("Form çok büyük.");
    const value = JSON.parse(json);
    if (!Array.isArray(value) || value.length > 12) throw Error("En fazla 12 form öğesi kullanılabilir.");
    const ids = new Set<string>();
    return value.map(item => {
        if (!item || typeof item.id !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(item.id) || ["constructor", "prototype", "__proto__"].includes(item.id) || ids.has(item.id)
            || !["text", "textarea", "checkbox", "button"].includes(item.type) || typeof item.label !== "string" || item.label.length > 100) throw Error("Geçersiz form öğesi.");
        ids.add(item.id);
        return { id: item.id, type: item.type, label: item.label };
    });
}
export function parseSettings(json: string): Record<string, string | number | boolean | null> {
    if (json.length > 16000) throw Error("Ayarlar 16.000 karakteri aşamaz.");
    const value = JSON.parse(json);
    if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).length > 50) throw Error("Ayarlar en fazla 50 alan içeren bir nesne olmalı.");
    for (const [key, field] of Object.entries(value)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key)
            || !(field === null || typeof field === "string" || typeof field === "boolean" || typeof field === "number" && Number.isFinite(field))) throw Error("Ayarlar yalnızca metin, sayı, boolean ve null içerebilir.");
    }
    return value;
}
