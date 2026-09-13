/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoTypingAnimation",
    authors: [Devs.AutumnVN],
    description: hyperTranslate("Disables the CPU-intensive typing dots animation"),
    tags: ["Appearance"],
    patches: [
        {
            find: "dotCycle",
            replacement: {
                match: /focused:(\i)/g,
                replace: (_, focused) => `_focused:${focused}=false`
            }
        }
    ]
});
