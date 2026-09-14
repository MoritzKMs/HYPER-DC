/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Only override the local-preview preference; never change window focus globally.
export const previewGetter = /get pauseSelfStreamPreviewWhenUnfocused\(\)\{return [A-Za-z_$][\w$]*\.pauseSelfStreamPreviewWhenUnfocused\?\?!0\}/;
