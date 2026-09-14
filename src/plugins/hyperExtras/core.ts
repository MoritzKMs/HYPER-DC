/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function alarmReady(previous: string[], current: string[], target: string, limit: number) {
    return target ? !previous.includes(target) && current.includes(target) : limit > 0 && previous.length >= limit && current.length < limit;
}
export function clipping(samples: Float32Array) {
    let count = 0;
    for (const sample of samples) if (Math.abs(sample) >= 0.98) count++;
    return count >= Math.max(3, samples.length * 0.005);
}
