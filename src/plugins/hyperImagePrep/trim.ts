/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function validTrim(from: number, to: number, duration: number) {
    return [from, to, duration].every(Number.isFinite) && duration > 0 && from >= 0 && to <= duration && to - from >= 0.25 && to - from <= 300;
}
