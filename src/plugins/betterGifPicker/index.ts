/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "BetterGifPicker",
    description: hyperTranslate("Makes the gif picker open the favourite category by default"),
    authors: [Devs.Samwich],
    tags: ["Emotes", "Customisation"],
    patches: [
        {
            find: "renderHeaderContent(){",
            replacement: [
                {
                    match: /(?<=state={resultType:)null/,
                    replace: '"Favorites"'
                }
            ]
        }
    ]
});
