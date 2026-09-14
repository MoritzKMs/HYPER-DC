/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin from "@utils/types";

import { previewGetter } from "./patch";

export default definePlugin({
    name: "HyperLivePreview",
    description: hyperTranslate("Keeps your own stream preview running when you switch to another window. Uses additional graphics resources. Restart Discord after enabling or disabling."),
    authors: [{ name: "HyperDC", id: 0n }],
    tags: ["Voice", "Utility"],
    enabledByDefault: true,
    patches: [{
        find: "get pauseSelfStreamPreviewWhenUnfocused(){",
        replacement: {
            match: previewGetter,
            replace: "get pauseSelfStreamPreviewWhenUnfocused(){return false}"
        }
    }]
});
