/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Only override the local-preview preference; never change window focus globally.
export const previewGetter = /get pauseSelfStreamPreviewWhenUnfocused\(\)\{return [A-Za-z_$][\w$]*\.pauseSelfStreamPreviewWhenUnfocused\?\?!0\}/;

// The floating player has its own focus check, independent of the preference above.
export const floatingPreviewGetter = /get streamerPaused\(\)\{let\{isMainWindowFocused:([A-Za-z_$][\w$]*),activeSelfStream:([A-Za-z_$][\w$]*),participantOnScreen:([A-Za-z_$][\w$]*)\}=this\.props;return null!=\2&&\3\?\.id===\(0,[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\)\(\2\)&&!\1\}/;
