/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface PersonalItem {
    id: string;
    channelId: string;
    text: string;
    done: boolean;
    messageId?: string;
    guildId?: string;
}

export function validateItems(value: unknown): PersonalItem[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((item): item is PersonalItem => {
        if (!item || typeof item.id !== "string" || seen.has(item.id)
            || typeof item.channelId !== "string" || !/^\d+$/.test(item.channelId)
            || typeof item.text !== "string" || item.text.length > 1000 || typeof item.done !== "boolean"
            || (item.messageId !== undefined && (typeof item.messageId !== "string" || !/^\d+$/.test(item.messageId)))
            || (item.guildId !== undefined && (typeof item.guildId !== "string" || !/^\d+$/.test(item.guildId)))) return false;
        seen.add(item.id);
        return true;
    }).slice(0, 500);
}

export interface Countdown { remaining: number; deadline: number | null; }
export function remainingTime(timer: Countdown, now: number): number {
    return Math.max(0, timer.deadline === null ? timer.remaining : timer.deadline - now);
}
export function pauseCountdown(timer: Countdown, now: number): Countdown {
    return { remaining: remainingTime(timer, now), deadline: null };
}
export function resumeCountdown(timer: Countdown, now: number): Countdown {
    return timer.deadline === null ? { ...timer, deadline: now + timer.remaining } : timer;
}
