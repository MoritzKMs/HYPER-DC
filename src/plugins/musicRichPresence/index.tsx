/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSetting, migratePluginSettings } from "@api/Settings";
import { LinkButton } from "@components/Button";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin, { OptionType } from "@utils/types";
import { Activity, ActivityAssets, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, AuthenticationStore, FluxDispatcher, PresenceStore } from "@webpack/common";

import { LastFMScrobbler } from "./lastfm";
import { invalidateListenBrainzCache, ListenBrainzScrobbler } from "./listenbrainz";

export interface TrackData {
    name: string;
    album: string;
    artist: string;
    trackURL?: string;
    artistURL?: string;
    albumURL?: string;
    imageURL?: string;
    serviceName?: string;
}

export interface ScrobblerBackend {
    name: string,
    id: string,

    fetchTrackData(): Promise<TrackData | null>;
    getUserURL(username: string): string;
}

const enum NameFormat {
    StatusName = "status-name",
    ArtistFirst = "artist-first",
    SongFirst = "song-first",
    ArtistOnly = "artist",
    SongOnly = "song",
    AlbumName = "album",
    ServiceName = "service-name"
}

const DISCORD_APP_ID = "1108588077900898414";
const LASTFM_PLACEHOLDER_IMAGE_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(DISCORD_APP_ID, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "LastFM",
    });
}

export const settings = definePluginSettings({
    scrobblerBackend: {
        description: hyperTranslate("The scrobbler backend to use."),
        type: OptionType.SELECT,
        options: [
            {
                "label": hyperTranslate("Last.FM"),
                "value": "lastfm",
                "default": true
            },
            {
                "label": hyperTranslate("ListenBrainz"),
                "value": "listenbrainz"
            },
            {
                "label": hyperTranslate("ListenBrainz Compatible (self-hosted)"),
                "value": "listenbrainz-compatible"
            }
        ] as const
    },
    instanceBaseURL: {
        description: hyperTranslate("The base url of your ListenBrainz instance."),
        type: OptionType.STRING,
        placeholder: "https://example.org",
        onChange: invalidateListenBrainzCache
    },
    instanceAPIBaseUrl: {
        description: hyperTranslate("The base url of your ListenBrainz API."),
        type: OptionType.STRING,
        placeholder: "https://api.example.org",
        onChange: invalidateListenBrainzCache
    },
    apiKey: {
        displayName: hyperTranslate("API Key"),
        description: hyperTranslate("Last.fm API key. Not required but highly recommended to avoid rate limiting with our shared key"),
        type: OptionType.STRING,
    },
    username: {
        description: hyperTranslate("Username"),
        type: OptionType.STRING,
    },
    shareUsername: {
        description: hyperTranslate("Show link to scrobbler profile"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    clickableLinks: {
        description: hyperTranslate("Make track, artist and album names clickable links"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithSpotify: {
        description: hyperTranslate("Hide presence if Spotify is running"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithActivity: {
        description: hyperTranslate("Hide presence if you have any other presence"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    statusName: {
        description: hyperTranslate("Custom status text. You can use the following variables: {artist} | {album} | {title}"),
        type: OptionType.STRING,
        default: "some music",
    },
    statusDisplayType: {
        description: hyperTranslate("Show the track / artist name in the member list"),
        type: OptionType.SELECT,
        options: [
            {
                label: hyperTranslate("Don't show (shows generic listening message)"),
                value: "off"
            },
            {
                label: hyperTranslate("Show artist name"),
                value: "artist",
                default: true
            },
            {
                label: hyperTranslate("Show track name"),
                value: "track"
            }
        ]
    },
    nameFormat: {
        description: hyperTranslate("Show name of song and artist in status name"),
        type: OptionType.SELECT,
        options: [
            {
                label: hyperTranslate("Use custom status name"),
                value: NameFormat.StatusName,
                default: true
            },
            {
                label: hyperTranslate("Use music service name (falls back to custom status text)"),
                value: NameFormat.ServiceName
            },
            {
                label: hyperTranslate("Use format 'artist - song'"),
                value: NameFormat.ArtistFirst
            },
            {
                label: hyperTranslate("Use format 'song - artist'"),
                value: NameFormat.SongFirst
            },
            {
                label: hyperTranslate("Use artist name only"),
                value: NameFormat.ArtistOnly
            },
            {
                label: hyperTranslate("Use song name only"),
                value: NameFormat.SongOnly
            },
            {
                label: hyperTranslate("Use album name (falls back to custom status text if song has no album)"),
                value: NameFormat.AlbumName
            }
        ],
    },
    useListeningStatus: {
        description: hyperTranslate("Show \"Listening to\" status instead of \"Playing\""),
        type: OptionType.BOOLEAN,
        default: false,
    },
    missingArt: {
        description: hyperTranslate("When album or album art is missing"),
        type: OptionType.SELECT,
        options: [
            {
                label: hyperTranslate("Use large scrobbler logo"),
                value: "logo",
                default: true
            },
            {
                label: hyperTranslate("Use generic placeholder"),
                value: "placeholder"
            }
        ],
    },
    showLogo: {
        displayName: hyperTranslate("Show Scrobbler Logo"),
        description: hyperTranslate("Show the scrobbler service logo by the album cover"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    showAlbumCover: {
        description: hyperTranslate("Show album cover. Disabling this will display a placeholder. Useful if your music has inappropriate art"),
        type: OptionType.BOOLEAN,
        default: true,
    }
}, {
    apiKey: { hidden() { return this.store.scrobblerBackend !== "lastfm"; } },
    instanceBaseURL: { hidden() { return this.store.scrobblerBackend !== "listenbrainz-compatible"; } },
    instanceAPIBaseUrl: { hidden() { return this.store.scrobblerBackend !== "listenbrainz-compatible"; } },
});

migratePluginSettings("MusicRichPresence", "LastFMRichPresence");
migratePluginSetting("MusicRichPresence", "showLastFmLogo", "showLogo");
export default definePlugin({
    name: "MusicRichPresence",
    description: hyperTranslate("Rich Presence for Last.FM/Listenbrainz"),
    tags: ["Activity", "Media"],
    searchTerms: ["lastfm", "LastFMRichPresence"],
    authors: [Devs.Rini, Devs.Ven, Devs.angelcube, Devs.RuiNtD, Devs.blahajZip, Devs.archeruwu],

    settings,

    settingsAboutComponent() {
        if (settings.store.scrobblerBackend !== "lastfm")
            return null;

        return (
            <Card>
                <Heading tag="h2">{hyperTranslate("Last.FM")}</Heading>
                <Heading tag="h5">{hyperTranslate("How to create an API key")}</Heading>
                <Paragraph>{hyperTranslate("Set") + " "}<strong>{hyperTranslate("Application name")}</strong> {hyperTranslate("and") + " "}<strong>{hyperTranslate("Application description")}</strong> {hyperTranslate("to anything and leave the rest blank.")}</Paragraph>
                <LinkButton size="small" href="https://www.last.fm/api/account/create" className={Margins.top8}>{hyperTranslate("Create API Key")}</LinkButton>
            </Card>
        );
    },

    start() {
        this.updatePresence();
        this.updateInterval = setInterval(() => { this.updatePresence(); }, 16000);
    },

    stop() {
        clearInterval(this.updateInterval);
    },

    async updatePresence() {
        const { username, scrobblerBackend, instanceAPIBaseUrl, instanceBaseURL } = settings.store;

        if (!username) return;
        if (scrobblerBackend === "listenbrainz-compatible" && (!instanceAPIBaseUrl || !instanceBaseURL)) return;

        setActivity(await this.getActivity());
    },

    getLargeImage(track: TrackData): string | undefined {
        if (settings.store.showAlbumCover && track.imageURL && !track.imageURL.includes(LASTFM_PLACEHOLDER_IMAGE_HASH))
            return track.imageURL;

        if (settings.store.missingArt === "placeholder")
            return "placeholder";
    },

    async getActivity(): Promise<Activity | null> {

        if (settings.store.hideWithActivity) {
            if (PresenceStore.getActivities(AuthenticationStore.getId()).some(a => a.application_id !== DISCORD_APP_ID && a.type !== ActivityType.CUSTOM_STATUS)) {
                return null;
            }
        }

        if (settings.store.hideWithSpotify) {
            if (PresenceStore.getActivities(AuthenticationStore.getId()).some(a => a.type === ActivityType.LISTENING && a.application_id !== DISCORD_APP_ID)) {
                // there is already music status because of Spotify or richerCider (probably more)
                return null;
            }
        }

        const scrobbler = settings.store.scrobblerBackend === "lastfm" ? LastFMScrobbler : ListenBrainzScrobbler;

        const trackData = await scrobbler.fetchTrackData();
        if (!trackData) return null;

        const largeImage = this.getLargeImage(trackData);
        const assets: ActivityAssets = largeImage ?
            {
                large_image: await getApplicationAsset(largeImage),
                large_text: trackData.album || undefined,
                ...(settings.store.showLogo && {
                    small_image: await getApplicationAsset(`${scrobbler.id}-small`),
                    small_text: scrobbler.id
                }),
            } : {
                large_image: await getApplicationAsset(`${scrobbler.id}-large`),
                large_text: trackData.album || undefined,
            };

        const buttons: ActivityButton[] = [];

        if (settings.store.shareUsername) {
            buttons.push({
                label: `${scrobbler.name} Profile`,
                url: scrobbler.getUserURL(settings.store.username!)
            });
        }

        const statusName = (() => {
            switch (settings.store.nameFormat) {
                case NameFormat.ArtistFirst:
                    return trackData.artist + " - " + trackData.name;
                case NameFormat.SongFirst:
                    return trackData.name + " - " + trackData.artist;
                case NameFormat.ArtistOnly:
                    return trackData.artist;
                case NameFormat.SongOnly:
                    return trackData.name;
                case NameFormat.AlbumName:
                    return trackData.album || settings.store.statusName
                        .replaceAll("{artist}", trackData.artist || "")
                        .replaceAll("{album}", trackData.album || "")
                        .replaceAll("{title}", trackData.name || "");
                case NameFormat.ServiceName:
                    return trackData.serviceName || settings.store.statusName
                        .replaceAll("{artist}", trackData.artist || "")
                        .replaceAll("{album}", trackData.album || "")
                        .replaceAll("{title}", trackData.name || "");
                default:
                    return settings.store.statusName
                        .replaceAll("{artist}", trackData.artist || "")
                        .replaceAll("{album}", trackData.album || "")
                        .replaceAll("{title}", trackData.name || "");
            }
        })();

        const activity: Activity = {
            application_id: DISCORD_APP_ID,
            name: statusName,

            details: trackData.name,
            state: trackData.artist,
            status_display_type: {
                "off": ActivityStatusDisplayType.NAME,
                "artist": ActivityStatusDisplayType.STATE,
                "track": ActivityStatusDisplayType.DETAILS
            }[settings.store.statusDisplayType],

            assets,

            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: {
                button_urls: buttons.map(v => v.url),
            },

            type: settings.store.useListeningStatus ? ActivityType.LISTENING : ActivityType.PLAYING,
            flags: ActivityFlags.INSTANCE,
        };

        if (settings.store.clickableLinks) {
            activity.details_url = trackData.trackURL;
            activity.state_url = trackData.artistURL;

            if (trackData.album) {
                activity.assets!.large_url = trackData.albumURL;
            }
        }

        return activity;
    }
});

