/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface MentionMessage {
    id: string;
    channel_id: string;
    author: { id: string; username?: string; global_name?: string; };
    mentions?: Array<string | { id: string; }>;
}

export function isDirectMention(message: MentionMessage, userId: string, optimistic = false) {
    return !optimistic && message.author?.id !== userId && /^\d+$/.test(message.id)
        && !!message.mentions?.some(m => (typeof m === "string" ? m : m.id) === userId);
}

export interface MentionEntry {
    id: string;
    channelId: string;
    guildId: string;
    channelName: string;
    guildName: string;
    sender: string;
    timestamp: number;
    read: boolean;
}

export function addMention(entries: MentionEntry[], entry: MentionEntry): MentionEntry[] {
    return entries.some(e => e.id === entry.id) ? entries : [entry, ...entries].slice(0, 200);
}

export function isAcknowledged(messageId: string, ackId: string | null | undefined) {
    return /^\d+$/.test(messageId) && typeof ackId === "string" && /^\d+$/.test(ackId) && BigInt(messageId) <= BigInt(ackId);
}
