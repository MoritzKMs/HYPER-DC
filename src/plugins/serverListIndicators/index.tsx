/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Sofia Lima
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { GuildStore, PresenceStore, RelationshipStore, useStateFromStores } from "@webpack/common";

const enum IndicatorType {
    SERVER = 1 << 0,
    FRIEND = 1 << 1,
    BOTH = SERVER | FRIEND,
}

const UserGuildJoinRequestStore = findStoreLazy("UserGuildJoinRequestStore");

const settings = definePluginSettings({
    mode: {
        description: hyperTranslate("Mode"),
        type: OptionType.SELECT,
        options: [
            { label: hyperTranslate("Only online friend count"), value: IndicatorType.FRIEND, default: true },
            { label: hyperTranslate("Only server count"), value: IndicatorType.SERVER },
            { label: hyperTranslate("Both server and online friend counts"), value: IndicatorType.BOTH },
        ]
    }
});

function FriendsIndicator() {
    const onlineFriendsCount = useStateFromStores([RelationshipStore, PresenceStore], () => {
        let count = 0;

        const friendIds = RelationshipStore.getFriendIDs();
        for (const id of friendIds) {
            const status = PresenceStore.getStatus(id) ?? "offline";
            if (status === "offline") {
                continue;
            }

            count++;
        }

        return count;
    });

    return (
        <span id="vc-friendcount" style={{
            display: "inline-block",
            width: "100%",
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--text-default)",
            textTransform: "uppercase",
            textAlign: "center",
        }}>
            {onlineFriendsCount} {hyperTranslate("online")}</span>
    );
}

function ServersIndicator() {
    const guildCount = useStateFromStores([GuildStore, UserGuildJoinRequestStore], () => {
        const guildJoinRequests: string[] = UserGuildJoinRequestStore.computeGuildIds();
        const guilds = GuildStore.getGuilds();

        // Filter only pending guild join requests
        return GuildStore.getGuildCount() + guildJoinRequests.filter(id => guilds[id] == null).length;
    });

    return (
        <span id="vc-guildcount" style={{
            display: "inline-block",
            width: "100%",
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--text-default)",
            textTransform: "uppercase",
            textAlign: "center",
        }}>
            {guildCount} {hyperTranslate("servers")}</span>
    );
}

export default definePlugin({
    name: "ServerListIndicators",
    description: hyperTranslate("Add online friend count or server count in the server list"),
    tags: ["Servers", "Appearance"],
    authors: [Devs.Rini],
    dependencies: ["ServerListAPI"],
    settings,

    renderIndicator: () => {
        const { mode } = settings.store;
        return <ErrorBoundary noop>
            <div style={{ marginBottom: "4px" }}>
                {!!(mode & IndicatorType.FRIEND) && <FriendsIndicator />}
                {!!(mode & IndicatorType.SERVER) && <ServersIndicator />}
            </div>
        </ErrorBoundary>;
    },

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    }
});
