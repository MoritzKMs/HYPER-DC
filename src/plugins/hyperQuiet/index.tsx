/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, GuildStore, React, RestAPI, UserGuildSettingsStore, UserStore } from "@webpack/common";

import { buildPatch, mergeBackup, NotificationPatch, restorePatch } from "./core";
import { InboxRow, openInbox, receiveMention, startInbox, stopInbox } from "./inbox";

const settings = definePluginSettings({
    mentionInbox: { type: OptionType.BOOLEAN, description: hyperTranslate("HyperDC mention inbox: show direct mentions like a DM avatar in the server rail"), default: true },
    mode: { type: OptionType.SELECT, description: "Bildirim modu", options: [
        { label: "Tamamen sustur", value: 2, default: true },
        { label: hyperTranslate("Mentions only"), value: 1 }
    ] },
    everyone: { type: OptionType.BOOLEAN, description: hyperTranslate("Suppress @everyone and @here notifications"), default: true },
    roles: { type: OptionType.BOOLEAN, description: hyperTranslate("Suppress role mentions"), default: true },
    events: { type: OptionType.BOOLEAN, description: "Etkinlik bildirimlerini sustur", default: true },
    highlights: { type: OptionType.BOOLEAN, description: hyperTranslate("Suppress highlights"), default: true },
    mobile: { type: OptionType.BOOLEAN, description: "Mobil push bildirimlerine izin ver", default: false },
    channels: { type: OptionType.BOOLEAN, description: hyperTranslate("Apply this mode to existing channel notification overrides too"), default: true }
});
interface AccountData { excluded: string[]; backups: Record<string, NotificationPatch>; }
let running = false;
let cancelled = false;
let active = false;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const accountId = () => UserStore.getCurrentUser()?.id;
const keyFor = (id: string) => `HyperQuiet:v1:${id}`;
async function load(id: string): Promise<AccountData> {
    return await DataStore.get<AccountData>(keyFor(id)) ?? { excluded: [], backups: {} };
}
function snapshot(id: string, includeChannels: boolean): NotificationPatch {
    const s = UserGuildSettingsStore;
    return {
        muted: s.isMuted(id), mute_config: s.getMuteConfig(id),
        message_notifications: s.getMessageNotifications(id),
        suppress_everyone: s.isSuppressEveryoneEnabled(id), suppress_roles: s.isSuppressRolesEnabled(id),
        mute_scheduled_events: s.isMuteScheduledEventsEnabled(id), notify_highlights: s.getNotifyHighlights(id),
        mobile_push: s.isMobilePushEnabled(id),
        ...(includeChannels ? { channel_overrides: Object.fromEntries(Object.entries(s.getChannelOverrides(id)).map(([cid, c]) => [cid, {
            muted: c.muted, mute_config: c.mute_config, message_notifications: c.message_notifications
        }])) } : {})
    };
}
async function writeSettings(id: string, body: NotificationPatch) {
    const response = await RestAPI.patch({ url: `/users/@me/guilds/${id}/settings`, body });
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    FluxDispatcher.dispatch({ type: "USER_GUILD_SETTINGS_GUILD_UPDATE", guildId: id, settings: response.body ?? body });
}
function Manager() {
    settings.use(["mentionInbox"]);
    const [data, setData] = React.useState<AccountData>({ excluded: [], backups: {} });
    const [owner, setOwner] = React.useState<string>();
    const [ready, setReady] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [busy, setBusy] = React.useState(running);
    const [message, setMessage] = React.useState(hyperTranslate("Loading server selection…"));
    const [confirmed, setConfirmed] = React.useState(false);
    React.useEffect(() => {
        let mounted = true;
        const id = accountId();
        if (id) load(id).then(value => {
            if (mounted) { setData(value); setOwner(id); setReady(true); setMessage(hyperTranslate("Excluded servers are left unchanged. This changes settings on your Discord account.")); }
        }).catch(() => { if (mounted) setMessage(hyperTranslate("Could not read local settings. No changes were started.")); });
        return () => { mounted = false; };
    }, []);
    const guilds = Object.values(GuildStore.getGuilds()).sort((a, b) => a.name.localeCompare(b.name));
    const targets = guilds.filter(g => !data.excluded.includes(g.id));
    async function exclude(id: string, checked: boolean) {
        if (!owner || owner !== accountId() || running) return;
        const next = { ...data, excluded: checked ? [...new Set([...data.excluded, id])] : data.excluded.filter(x => x !== id) };
        setBusy(true);
        try { await DataStore.set(keyFor(owner), next); setData(next); setConfirmed(false); }
        catch { setMessage(hyperTranslate("Could not save the exception. Your previous selection was kept.")); }
        finally { setBusy(false); }
    }
    async function run(restore: boolean) {
        if (!owner || owner !== accountId() || !ready || running) return;
        if (!restore && !confirmed) return;
        running = true; cancelled = false; setBusy(true);
        let ok = 0;
        let failed = 0;
        const options = { ...settings.store };
        try {
            const work = await load(owner);
            const ids = restore ? Object.keys(work.backups).filter(id => GuildStore.getGuild(id)) : targets.map(g => g.id);
            for (const id of ids) {
                if (cancelled || !active || accountId() !== owner) break;
                setMessage(`${restore ? hyperTranslate("Restoring") : hyperTranslate("Applying")}: ${ok + failed + 1}/${ids.length} · ${GuildStore.getGuild(id)?.name ?? id}`);
                try {
                    const channelIds = Object.keys(UserGuildSettingsStore.getChannelOverrides(id));
                    if (!restore) {
                        work.backups[id] = mergeBackup(work.backups[id], snapshot(id, options.channels));
                        await DataStore.set(keyFor(owner), work);
                    }
                    if (cancelled || !active || accountId() !== owner) break;
                    const body = restore
                        ? restorePatch(work.backups[id], new Set(Object.keys(work.backups[id].channel_overrides as object ?? {}).filter(cid => ChannelStore.getChannel(cid))))
                        : buildPatch(options, channelIds);
                    await writeSettings(id, body);
                    if (restore) { delete work.backups[id]; await DataStore.set(keyFor(owner), work); }
                    ok++;
                } catch { failed++; }
                if (failed) break;
                await pause(1100);
            }
            setData(work);
            setMessage(`${ok} sunucu ${restore ? hyperTranslate("restored") : hyperTranslate("updated")}.${failed ? hyperTranslate("An error occurred. No further requests were sent. Remaining backups are preserved.") : ""}${cancelled || accountId() !== owner ? hyperTranslate("Operation stopped.") : ""}`);
        } catch { setMessage(hyperTranslate("Could not read or save the local backup. Operation stopped.")); }
        finally { running = false; setBusy(false); setConfirmed(false); }
    }
    return <div className="hyper-quiet">
        <h2>{hyperTranslate("HYPER Quiet")}</h2>
        <label><input type="checkbox" checked={settings.store.mentionInbox} onChange={e => { settings.store.mentionInbox = e.target.checked; }} /> {hyperTranslate("HyperDC mention inbox enabled")}</label>
        <button onClick={openInbox}>{hyperTranslate("Open HyperDC mention inbox")}</button>
        <p>{hyperTranslate("Mute your servers in one operation. Exclude servers below to preserve their current notification settings.")}</p>
        <input aria-label="Sunucu ara" placeholder={hyperTranslate("Search by server name…")} value={query} onChange={e => setQuery(e.target.value)} />
        <div className="hyper-quiet-list">{guilds.filter(g => g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(g => <label key={g.id}>
            <input type="checkbox" disabled={busy || !ready} checked={data.excluded.includes(g.id)} onChange={e => void exclude(g.id, e.target.checked)} />
            <span>{g.name}<small>{data.excluded.includes(g.id) ? hyperTranslate("Excluded — current settings preserved") : hyperTranslate("Will apply")}</small></span>
        </label>)}</div>
        <p>{targets.length} {hyperTranslate("sunucuya uygulanacak ·") + " "}{data.excluded.length} istisna · {Object.keys(data.backups).length} yedek</p>
        <label className="hyper-quiet-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> {hyperTranslate("Apply the settings below to unselected servers.")}</label>
        <div className="hyper-quiet-actions"><button disabled={!ready || busy || !confirmed || !targets.length} onClick={() => void run(false)}>{hyperTranslate("Apply settings")}</button>
            <button disabled={!ready || busy || !Object.keys(data.backups).length} onClick={() => void run(true)}>Yedekten geri al</button>
            <button disabled={!running} onClick={() => { cancelled = true; setMessage(hyperTranslate("Will stop after the current request finishes.")); }}>Durdur</button></div>
        <p role="status" aria-live="polite">{message}</p>
        <small>{hyperTranslate("Restore returns the fields changed by this plugin to their first backup, including later edits to those fields. DM notifications are unchanged. Disabling the plugin does not restore settings.")}</small>
    </div>;
}
export default definePlugin({
    name: "HyperQuiet",
    description: hyperTranslate("Bulk server notification management, server exceptions and account-specific restore. HyperDC."),
    authors: [{ name: "HYPER DC", id: 0n }],
    tags: ["Notifications", "Servers"],
    enabledByDefault: true,
    settings,
    settingsAboutComponent: Manager,
    patches: [{
        find: '"guild-list-unread-dms"',
        replacement: {
            match: /(\(0,\i\.jsx\)\(\i\.\i,\{id:"guild-list-unread-dms".+?children:\i\}\)\}\))/,
            replace: "$self.renderRail($1)"
        }
    }],
    renderRail: (original: React.ReactNode) => <>{original}<RailEntry /></>,
    flux: { MESSAGE_CREATE: receiveMention },
    start() { active = true; startInbox(() => settings.store.mentionInbox); },
    stop() { active = false; cancelled = true; stopInbox(); }
});

function RailEntry() {
    settings.use(["mentionInbox"]);
    return settings.store.mentionInbox ? <InboxRow /> : null;
}
