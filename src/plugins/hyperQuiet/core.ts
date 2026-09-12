/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface QuietOptions {
    mode: number;
    everyone: boolean;
    roles: boolean;
    events: boolean;
    highlights: boolean;
    mobile: boolean;
    channels: boolean;
}
export type NotificationPatch = Record<string, unknown>;
export function buildPatch(options: QuietOptions, channelIds: string[]): NotificationPatch {
    const patch: NotificationPatch = {
        muted: options.mode === 2,
        mute_config: { selected_time_window: -1, end_time: null },
        message_notifications: options.mode,
        suppress_everyone: options.everyone,
        suppress_roles: options.roles,
        mute_scheduled_events: options.events,
        notify_highlights: options.highlights ? 1 : 0,
        mobile_push: options.mobile
    };
    if (options.channels) patch.channel_overrides = Object.fromEntries(channelIds.map(id => [id, {
        muted: options.mode === 2,
        mute_config: { selected_time_window: -1, end_time: null },
        message_notifications: options.mode
    }]));
    return patch;
}
export function mergeBackup(previous: NotificationPatch | undefined, current: NotificationPatch): NotificationPatch {
    if (!previous) return structuredClone(current);
    return {
        ...current, ...previous,
        ...(current.channel_overrides || previous.channel_overrides ? {
            channel_overrides: {
                ...(current.channel_overrides as object ?? {}),
                ...(previous.channel_overrides as object ?? {})
            }
        } : {})
    };
}
export function restorePatch(backup: NotificationPatch, liveChannelIds: Set<string>): NotificationPatch {
    const result = structuredClone(backup);
    if (result.channel_overrides) result.channel_overrides = Object.fromEntries(
        Object.entries(result.channel_overrides as object).filter(([id]) => liveChannelIds.has(id))
    );
    return result;
}
