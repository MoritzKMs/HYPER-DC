/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin from "@utils/types";

import theme from "./theme.css?managed";

export default definePlugin({
    name: "HyperTheme",
    description: hyperTranslate("HyperDC: charcoal surfaces, orange accents and rounded corners. Designed for dark mode."),
    authors: [{ name: "HYPER DC", id: 0n }],
    enabledByDefault: true,
    managedStyle: theme
});
