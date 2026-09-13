/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    defaultLayout: {
        type: OptionType.SELECT,
        options: [
            { label: hyperTranslate("List"), value: 1, default: true },
            { label: hyperTranslate("Gallery"), value: 2 }
        ],
        description: hyperTranslate("Which layout to use as default")
    },
    defaultSortOrder: {
        type: OptionType.SELECT,
        options: [
            { label: hyperTranslate("Recently Active"), value: 0, default: true },
            { label: hyperTranslate("Date Posted"), value: 1 }
        ],
        description: hyperTranslate("Which sort order to use as default")
    }
});

export default definePlugin({
    name: "OverrideForumDefaults",
    description: hyperTranslate("Allows you to override default forum layout/sort order. you can still change it on a per-channel basis"),
    tags: ["Servers", "Organisation", "Customisation"],
    authors: [Devs.Inbestigator],
    patches: [
        {
            find: "getDefaultLayout(){",
            replacement: [
                {
                    match: /}getDefaultLayout\(\){/,
                    replace: "$&return $self.getLayout();"
                },
                {
                    match: /}getDefaultSortOrder\(\){/,
                    replace: "$&return $self.getSortOrder();"
                }
            ]
        }
    ],

    getLayout: () => settings.store.defaultLayout,
    getSortOrder: () => settings.store.defaultSortOrder,

    settings
});
