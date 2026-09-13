/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

export default definePlugin({
    name: "HyperDCLanguage",
    description: "HyperDC Dil / Language — Türkçe veya English. Dil değişikliğinden sonra yeniden başlatın / Restart after changing language.",
    authors: [{ name: "HyperDC", id: 0n }],
    required: true,
    settings: definePluginSettings({
        language: {
            type: OptionType.SELECT,
            displayName: "Dil / Language",
            description: "HyperDC ve eklentilerin arayüz dili / HyperDC and plugin interface language",
            options: [
                { label: "Türkçe", value: "tr", default: true },
                { label: "English", value: "en" }
            ],
            restartNeeded: true
        }
    })
});
