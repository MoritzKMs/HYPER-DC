/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { IS_MAC } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import { Margins } from "@utils/margins";
import { identity } from "@utils/misc";
import { Forms, Select } from "@webpack/common";

export function MacOSVibrancySettings() {
    const settings = useSettings(["macosVibrancyStyle"]);

    if (!IS_MAC || IS_WEB) return null;

    return (
        <ErrorBoundary noop>
            <Forms.FormTitle tag="h5">{hyperTranslate("MacOS Window vibrancy style (requires restart)")}</Forms.FormTitle>
            <Select
                className={Margins.bottom20}
                placeholder={hyperTranslate("Window vibrancy style")}
                options={[
                    // Sorted from most opaque to most transparent
                    {
                        label: hyperTranslate("No vibrancy"), value: undefined
                    },
                    {
                        label: hyperTranslate("Under Page (window tinting)"),
                        value: "under-page"
                    },
                    {
                        label: hyperTranslate("Content"),
                        value: "content"
                    },
                    {
                        label: hyperTranslate("Window"),
                        value: "window"
                    },
                    {
                        label: hyperTranslate("Selection"),
                        value: "selection"
                    },
                    {
                        label: hyperTranslate("Titlebar"),
                        value: "titlebar"
                    },
                    {
                        label: hyperTranslate("Header"),
                        value: "header"
                    },
                    {
                        label: hyperTranslate("Sidebar"),
                        value: "sidebar"
                    },
                    {
                        label: hyperTranslate("Tooltip"),
                        value: "tooltip"
                    },
                    {
                        label: hyperTranslate("Menu"),
                        value: "menu"
                    },
                    {
                        label: "Popover",
                        value: "popover"
                    },
                    {
                        label: hyperTranslate("Fullscreen UI (transparent but slightly muted)"),
                        value: "fullscreen-ui"
                    },
                    {
                        label: hyperTranslate("HUD (Most transparent)"),
                        value: "hud"
                    },
                ]}
                select={v => settings.macosVibrancyStyle = v}
                isSelected={v => settings.macosVibrancyStyle === v}
                serialize={identity}
            />
        </ErrorBoundary>
    );
}
