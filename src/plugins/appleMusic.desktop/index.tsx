/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { Devs, IS_MAC } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin, { OptionType, PluginNative, ReporterTestable } from "@utils/types";
import { Activity, ActivityAssets, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

const Native = VencordNative.pluginHelpers.AppleMusicRichPresence as PluginNative<typeof import("./native")>;

export interface TrackData {
    name: string;
    album?: string;
    artist?: string;

    appleMusicLink?: string;
    appleMusicArtistLink?: string;
    songLink?: string;

    albumArtwork?: string;
    artistArtwork?: string;

    playerPosition?: number;
    duration?: number;
}

const enum AssetImageType {
    Album = "Album",
    Artist = "Artist",
    Disabled = "Disabled"
}

const enum LinkType {
    Album = "Album",
    Artist = "Artist",
    Disabled = "Disabled"
}

const applicationId = "1239490006054207550";

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "AppleMusic",
    });
}

const settings = definePluginSettings({
    activityType: {
        type: OptionType.SELECT,
        description: hyperTranslate("Which type of activity"),
        options: [
            { label: hyperTranslate("Playing"), value: ActivityType.PLAYING, default: true },
            { label: hyperTranslate("Listening"), value: ActivityType.LISTENING }
        ],
    },
    statusDisplayType: {
        description: hyperTranslate("Show the track / artist name in the member list"),
        type: OptionType.SELECT,
        options: [
            {
                label: hyperTranslate("Don't show (shows generic listening message)"),
                value: "off",
                default: true
            },
            {
                label: hyperTranslate("Show artist name"),
                value: "artist"
            },
            {
                label: hyperTranslate("Show track name"),
                value: "track"
            }
        ]
    },
    refreshInterval: {
        type: OptionType.SLIDER,
        description: hyperTranslate("The interval between activity refreshes (seconds)"),
        markers: [1, 2, 2.5, 3, 5, 10, 15],
        default: 5,
        restartNeeded: true,
    },
    enableTimestamps: {
        type: OptionType.BOOLEAN,
        description: hyperTranslate("Whether or not to enable timestamps"),
        default: true,
    },
    enableButtons: {
        type: OptionType.BOOLEAN,
        description: hyperTranslate("Whether or not to enable buttons"),
        default: true,
    },
    nameString: {
        type: OptionType.STRING,
        description: hyperTranslate("Activity name format string"),
        default: "Apple Music"
    },
    detailsString: {
        type: OptionType.STRING,
        description: hyperTranslate("Activity details format string"),
        default: "{name}"
    },
    stateString: {
        type: OptionType.STRING,
        description: hyperTranslate("Activity state format string"),
        default: "{artist} · {album}"
    },
    detailsLink: {
        type: OptionType.SELECT,
        description: hyperTranslate("Activity details link"),
        options: [
            { label: hyperTranslate("Album"), value: LinkType.Album, default: true },
            { label: hyperTranslate("Artist"), value: LinkType.Artist },
            { label: hyperTranslate("Disabled"), value: LinkType.Disabled }
        ],
    },
    stateLink: {
        type: OptionType.SELECT,
        description: hyperTranslate("Activity state link"),
        options: [
            { label: hyperTranslate("Album"), value: LinkType.Album },
            { label: hyperTranslate("Artist"), value: LinkType.Artist, default: true },
            { label: hyperTranslate("Disabled"), value: LinkType.Disabled }
        ],
    },
    largeImageType: {
        type: OptionType.SELECT,
        description: hyperTranslate("Activity assets large image type"),
        options: [
            { label: hyperTranslate("Album artwork"), value: AssetImageType.Album, default: true },
            { label: hyperTranslate("Artist artwork"), value: AssetImageType.Artist },
            { label: hyperTranslate("Disabled"), value: AssetImageType.Disabled }
        ],
    },
    largeTextString: {
        type: OptionType.STRING,
        description: hyperTranslate("Activity assets large text format string"),
        default: "{album}"
    },
    largeImageLink: {
        type: OptionType.SELECT,
        description: hyperTranslate("Activity assets large image link"),
        options: [
            { label: hyperTranslate("Album"), value: LinkType.Album, default: true },
            { label: hyperTranslate("Artist"), value: LinkType.Artist },
            { label: hyperTranslate("Disabled"), value: LinkType.Disabled }
        ],
    },
    smallImageType: {
        type: OptionType.SELECT,
        description: hyperTranslate("Activity assets small image type"),
        options: [
            { label: hyperTranslate("Album artwork"), value: AssetImageType.Album },
            { label: hyperTranslate("Artist artwork"), value: AssetImageType.Artist, default: true },
            { label: hyperTranslate("Disabled"), value: AssetImageType.Disabled }
        ],
    },
    smallTextString: {
        type: OptionType.STRING,
        description: hyperTranslate("Activity assets small text format string"),
        default: "{artist}"
    },
    smallImageLink: {
        type: OptionType.SELECT,
        description: hyperTranslate("Activity assets small image link"),
        options: [
            { label: hyperTranslate("Album"), value: LinkType.Album },
            { label: hyperTranslate("Artist"), value: LinkType.Artist, default: true },
            { label: hyperTranslate("Disabled"), value: LinkType.Disabled }
        ],
    },
});

function customFormat(formatStr: string, data: TrackData) {
    return formatStr
        .replaceAll("{name}", data.name)
        .replaceAll("{album}", data.album ?? "")
        .replaceAll("{artist}", data.artist ?? "");
}

function getLink(type: LinkType, data: TrackData) {
    return type === LinkType.Album
        ? data.appleMusicLink
        : type === LinkType.Artist
            ? data.appleMusicArtistLink
            : undefined;
}

function getImageAsset(type: AssetImageType, data: TrackData) {
    const source = type === AssetImageType.Album
        ? data.albumArtwork
        : data.artistArtwork;

    if (!source) return undefined;

    return ApplicationAssetUtils.fetchAssetIds(applicationId, [source]).then(ids => ids[0]);
}

export default definePlugin({
    name: "AppleMusicRichPresence",
    description: hyperTranslate("Discord rich presence for your Apple Music!"),
    tags: ["Activity", "Media"],
    authors: [Devs.RyanCaoDev],
    hidden: !IS_MAC,
    reporterTestable: ReporterTestable.None,

    settingsAboutComponent() {
        return <>
            <Paragraph>
                {hyperTranslate("For the customizable activity format strings, you can use several special strings to include track data in activities!")}{" "}
                <code>{"{name}"}</code> {hyperTranslate("is replaced with the track name;") + " "}<code>{"{artist}"}</code> {hyperTranslate("is replaced with the artist(s)' name(s); and") + " "}<code>{"{album}"}</code> {hyperTranslate("is replaced with the album name.")}</Paragraph>
        </>;
    },

    settings,

    start() {
        this.updatePresence();
        this.updateInterval = setInterval(() => { this.updatePresence(); }, settings.store.refreshInterval * 1000);
    },

    stop() {
        clearInterval(this.updateInterval);
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
    },

    updatePresence() {
        this.getActivity().then(activity => { setActivity(activity); });
    },

    async getActivity(): Promise<Activity | null> {
        const trackData = await Native.fetchTrackData();
        if (!trackData) return null;

        const [largeImageAsset, smallImageAsset] = await Promise.all([
            getImageAsset(settings.store.largeImageType, trackData),
            getImageAsset(settings.store.smallImageType, trackData)
        ]);

        const assets: ActivityAssets = {};

        const isRadio = Number.isNaN(trackData.duration) && (trackData.playerPosition === 0);

        if (settings.store.largeImageType !== AssetImageType.Disabled) {
            assets.large_image = largeImageAsset;
            if (!isRadio) assets.large_text = customFormat(settings.store.largeTextString, trackData);
            assets.large_url = getLink(settings.store.largeImageLink, trackData);
        }

        if (settings.store.smallImageType !== AssetImageType.Disabled) {
            assets.small_image = smallImageAsset;
            if (!isRadio) assets.small_text = customFormat(settings.store.smallTextString, trackData);
            assets.small_url = getLink(settings.store.smallImageLink, trackData);
        }

        const buttons: ActivityButton[] = [];

        if (settings.store.enableButtons) {
            if (trackData.appleMusicLink)
                buttons.push({
                    label: hyperTranslate("Listen on Apple Music"),
                    url: trackData.appleMusicLink,
                });

            if (trackData.songLink)
                buttons.push({
                    label: hyperTranslate("View on SongLink"),
                    url: trackData.songLink,
                });
        }

        return {
            application_id: applicationId,

            name: customFormat(settings.store.nameString, trackData),
            details: customFormat(settings.store.detailsString, trackData),
            state: isRadio ? undefined : customFormat(settings.store.stateString, trackData),
            details_url: getLink(settings.store.detailsLink, trackData),
            state_url: getLink(settings.store.stateLink, trackData),

            timestamps: (trackData.playerPosition && trackData.duration && settings.store.enableTimestamps) ? {
                start: Date.now() - (trackData.playerPosition * 1000),
                end: Date.now() - (trackData.playerPosition * 1000) + (trackData.duration * 1000),
            } : undefined,

            assets,

            buttons: !isRadio && buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: !isRadio && buttons.length ? { button_urls: buttons.map(v => v.url) } : undefined,

            type: settings.store.activityType,
            status_display_type: {
                "off": ActivityStatusDisplayType.NAME,
                "artist": ActivityStatusDisplayType.STATE,
                "track": ActivityStatusDisplayType.DETAILS
            }[settings.store.statusDisplayType],
            flags: ActivityFlags.INSTANCE,
        };
    }
});
