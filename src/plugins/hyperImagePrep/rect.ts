/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function rectangle(rect: { x: number; y: number; width: number; height: number; }, width: number, height: number) {
    const clean = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const x = Math.min(clean(rect.x), width), y = Math.min(clean(rect.y), height);
    return { x, y, width: Math.min(clean(rect.width), width - x), height: Math.min(clean(rect.height), height - y) };
}
