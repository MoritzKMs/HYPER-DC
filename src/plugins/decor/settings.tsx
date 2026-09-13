/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TextButton } from "@components/Button";
import { hyperTranslate } from "@utils/hyperLanguage";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { OptionType } from "@utils/types";
import { Forms, SettingsRouter } from "@webpack/common";

import DecorPlugin from ".";
import DecorSection from "./ui/components/DecorSection";

export const settings = definePluginSettings({
    changeDecoration: {
        type: OptionType.COMPONENT,
        component({ closePluginSettings }) {
            if (!DecorPlugin.started) return <Forms.FormText>
                {hyperTranslate("Enable Decor and restart your client to change your avatar decoration.")}</Forms.FormText>;

            return <div>
                <DecorSection hideTitle hideDivider noMargin />
                <Forms.FormText className={classes(Margins.top8, Margins.bottom8)}>
                    {hyperTranslate("You can also access Decor decorations from the") + " "}<TextButton
                        variant="link"
                        onClick={async () => {
                            closePluginSettings();
                            SettingsRouter.openUserSettings("profile_panel");
                        }}
                    >{hyperTranslate("Profiles")}</TextButton> {hyperTranslate("page.")}</Forms.FormText>
            </div>;
        }
    },
    agreedToGuidelines: {
        type: OptionType.BOOLEAN,
        description: hyperTranslate("Agreed to guidelines"),
        hidden: true,
        default: false
    }
});
