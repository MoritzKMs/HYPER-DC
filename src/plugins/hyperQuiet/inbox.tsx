/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { hyperTranslate } from "@utils/hyperLanguage";
import { ChannelStore, GuildStore, Modal, NavigationRouter, openModal, React, UserStore, useStateFromStores } from "@webpack/common";

import { addMention, isDirectMention, MentionEntry, MentionMessage } from "./mentions";

let entries: MentionEntry[] = [];
let owner: string | undefined;
let enabled = () => false;
let active = false;
let revision = 0;
let failure = "";
let queue = Promise.resolve();
const readIds = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
const emit = () => { revision++; listeners.forEach(fn => fn()); };
const key = (id: string) => `HyperDC:MentionInbox:v1:${id}`;
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function useInbox() {
    const id = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id);
    React.useSyncExternalStore(subscribe, () => revision);
    React.useEffect(() => { void enqueue(async () => { if (id) await load(id); }); }, [id]);
    return id && owner === id ? entries : [];
}
function enqueue(task: () => Promise<void>) {
    queue = queue.then(task).catch(() => { failure = hyperTranslate("Could not read or save the local inbox. Restart Discord to retry."); emit(); });
    return queue;
}
async function load(id: string) {
    if (owner === id) return;
    const saved = await DataStore.get<MentionEntry[]>(key(id));
    if (!active || UserStore.getCurrentUser()?.id !== id) return;
    owner = id;
    entries = Array.isArray(saved) ? saved.filter(e => e && typeof e.id === "string" && typeof e.channelId === "string").slice(0, 200) : [];
    failure = "";
    emit();
}
export function startInbox(getEnabled: () => boolean) { active = true; enabled = getEnabled; }
export function stopInbox() { active = false; owner = undefined; entries = []; emit(); }
export function receiveMention({ message, optimistic }: { message: MentionMessage; optimistic?: boolean; }) {
    const id = UserStore.getCurrentUser()?.id;
    if (!active || !enabled() || !id || !isDirectMention(message, id, optimistic)) return;
    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel?.guild_id) return;
    const entry: MentionEntry = {
        id: message.id, channelId: channel.id, guildId: channel.guild_id,
        channelName: channel.name, guildName: GuildStore.getGuild(channel.guild_id)?.name ?? "Sunucu",
        sender: message.author.global_name || message.author.username || "Birisi", timestamp: Date.now(), read: false
    };
    void enqueue(async () => {
        if (!active || !enabled() || UserStore.getCurrentUser()?.id !== id) return;
        await load(id);
        if (!active || owner !== id || UserStore.getCurrentUser()?.id !== id) return;
        const next = addMention(entries, entry);
        if (next === entries) return;
        await DataStore.set(key(id), next);
        if (active && owner === id && UserStore.getCurrentUser()?.id === id) { entries = next.map(e => readIds.get(id)?.has(e.id) ? { ...e, read: true } : e); emit(); }
    });
}
async function markRead(ids: string[]) {
    const id = UserStore.getCurrentUser()?.id;
    if (!id || !ids.length || owner !== id) return;
    const seen = readIds.get(id) ?? new Set<string>();
    ids.forEach(messageId => seen.add(messageId));
    readIds.set(id, seen);
    entries = entries.map(e => seen.has(e.id) ? { ...e, read: true } : e);
    emit();
    await enqueue(async () => {
        if (!active || owner !== id || UserStore.getCurrentUser()?.id !== id) return;
        await DataStore.set(key(id), entries);
    });
}
export function HyperLogo() {
    return <svg className="hyper-inbox-logo" aria-hidden="true" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="54" fill="#141414" /><path d="M72 45h43l-13 61h40l13-61h43l-35 166h-43l14-64H94l-14 64H37z" fill="#fc7045" /><path d="M187 184h30v27h-36z" fill="#eee8de" /></svg>;
}
function Inbox({ close }: { close: () => void; }) {
    const rows = useInbox();
    React.useEffect(() => { void markRead(rows.filter(e => !e.read).map(e => e.id)); }, [rows.filter(e => !e.read).map(e => e.id).join(",")]);
    return <div className="hyper-inbox">
        <header><HyperLogo /><div><strong>HyperDC</strong><p>{hyperTranslate("Yerel etiket kutusu · Son 200 bildirim")}</p></div></header>
        <p>{hyperTranslate("Direct server mentions received while Discord is open appear here. This inbox is not a real Discord account.")}</p>
        {failure && <p role="alert">{failure}</p>}
        {!rows.length && <p>{hyperTranslate("No mentions yet. Mentions received while this feature is enabled will appear here.")}</p>}
        <div className="hyper-inbox-messages">{rows.map(row => <article key={row.id}>
            <HyperLogo /><div><strong>HyperDC</strong> <time>{new Date(row.timestamp).toLocaleString("tr-TR")}</time>
                <p><b>{row.sender}</b> {hyperTranslate("marked you in")} <b>#{row.channelName}</b> {hyperTranslate("channel.")}</p>
                <small>{row.guildName}</small>
                <button onClick={() => { close(); NavigationRouter.transitionTo(`/channels/${row.guildId}/${row.channelId}/${row.id}`); }}>{hyperTranslate("Go to message")}</button>
            </div>
        </article>)}</div>
    </div>;
}
export function openInbox() {
    void markRead(entries.filter(e => !e.read).map(e => e.id));
    openModal(props => <Modal {...props} title="HyperDC"><Inbox close={props.onClose} /></Modal>, { modalKey: "hyperdc-mention-inbox" });
}
export function InboxRow() {
    const rows = useInbox();
    const unread = rows.filter(e => !e.read).length;
    if (!unread) return null;
    return <div className="hyper-inbox-rail" role="group" aria-label="HyperDC etiket bildirimi">
        <button className="hyper-inbox-avatar" onClick={openInbox} title={`HyperDC · ${unread} yeni etiket`} aria-label={`HyperDC, ${unread} okunmamış etiket`}>
            <HyperLogo /><b className="hyper-inbox-rail-badge">{unread > 99 ? "99+" : unread}</b>
        </button>
    </div>;
}
