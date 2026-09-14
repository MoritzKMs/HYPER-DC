/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, createRoot, FluxDispatcher, NavigationRouter, Parser, PermissionsBits, PermissionStore, React, RestAPI, UserStore } from "@webpack/common";

type Row = { id: string; channel_id: string; content: string; author: { username: string; }; attachments?: { filename: string; }[]; };
let dismiss: (() => void) | undefined;
export function closeSideChat() { dismiss?.(); dismiss = undefined; }
export function openSideChat(channelId: string) {
    closeSideChat();
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    dismiss = () => { root.unmount(); host.remove(); };
    root.render(<SideChat channelId={channelId} />);
}
function SideChat({ channelId }: { channelId: string; }) {
    const owner = React.useRef(UserStore.getCurrentUser()?.id);
    const [rows, setRows] = React.useState<Row[]>([]);
    const [status, setStatus] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const sequence = React.useRef(0);
    const pendingEdits = React.useRef(new Map<string, Partial<Row> | null>());
    const fetching = React.useRef(false);
    const channel = ChannelStore.getChannel(channelId);
    const allowed = () => owner.current === UserStore.getCurrentUser()?.id && !!ChannelStore.getChannel(channelId) && (!channel?.guild_id || PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel) && PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel));
    async function refresh() {
        if (busy || !allowed()) return;
        const token = ++sequence.current; pendingEdits.current.clear(); fetching.current = true; setBusy(true); setStatus("");
        try {
            const response = await RestAPI.get({ url: `/channels/${channelId}/messages`, query: { limit: 30 } });
            if (token !== sequence.current || !allowed()) return;
            if (!Array.isArray(response.body)) throw Error();
            setRows(previous => {
                const merged = new Map<string, Row>(response.body.map((row: Row) => [row.id, row]));
                for (const row of previous) if (!merged.has(row.id) && row.id > (response.body[0]?.id ?? "")) merged.set(row.id, row);
                for (const [id, edit] of pendingEdits.current) {
                    if (edit === null) merged.delete(id);
                    else if (merged.has(id)) merged.set(id, { ...merged.get(id)!, ...edit });
                }
                return [...merged.values()].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id)).slice(-50);
            });
        } catch { if (token === sequence.current) setStatus("Mesajlar alınamadı. Kanal erişimini kontrol et veya biraz sonra yenile."); }
        finally { if (token === sequence.current) { fetching.current = false; setBusy(false); } }
    }
    React.useEffect(() => {
        void refresh();
        const check = () => { if (!allowed()) closeSideChat(); };
        const receive = (event: { message: Row; }) => { if (allowed() && event.message.channel_id === channelId) setRows(current => [...current.filter(row => row.id !== event.message.id), event.message].slice(-50)); };
        const edit = (event: { message: Partial<Row> & { id: string; channel_id: string; }; }) => { if (event.message.channel_id === channelId) { if (fetching.current) pendingEdits.current.set(event.message.id, event.message); setRows(current => current.map(row => row.id === event.message.id ? { ...row, ...event.message } : row)); } };
        const remove = (event: { channelId: string; id?: string; ids?: string[]; }) => { if (event.channelId === channelId) { if (fetching.current) for (const id of event.ids || (event.id ? [event.id] : [])) pendingEdits.current.set(id, null); setRows(current => current.filter(row => row.id !== event.id && !event.ids?.includes(row.id))); } };
        FluxDispatcher.subscribe("MESSAGE_CREATE", receive); FluxDispatcher.subscribe("MESSAGE_UPDATE", edit); FluxDispatcher.subscribe("MESSAGE_DELETE", remove); FluxDispatcher.subscribe("MESSAGE_DELETE_BULK", remove);
        UserStore.addChangeListener(check); PermissionStore.addChangeListener(check); ChannelStore.addChangeListener(check);
        return () => { sequence.current++; FluxDispatcher.unsubscribe("MESSAGE_CREATE", receive); FluxDispatcher.unsubscribe("MESSAGE_UPDATE", edit); FluxDispatcher.unsubscribe("MESSAGE_DELETE", remove); FluxDispatcher.unsubscribe("MESSAGE_DELETE_BULK", remove); UserStore.removeChangeListener(check); PermissionStore.removeChangeListener(check); ChannelStore.removeChangeListener(check); };
    }, []);
    return <aside className="hyper-extra-panel hyper-tools" aria-label="Yan sohbet"><strong>#{channel?.name || "Sohbet"}</strong><div className="hyper-tools-actions"><button onClick={closeSideChat}>Kapat</button><button disabled={busy} onClick={() => void refresh()}>Yenile</button><button onClick={() => NavigationRouter.transitionTo(`/channels/${channel?.guild_id || "@me"}/${channelId}`)}>Yanıtlamak için aç</button></div><small>Son 50 mesaj · Salt okunur · Otomatik okundu işaretlemez.</small><p role="status">{status || (busy ? "Yükleniyor…" : "")}</p><div className="hyper-extra-messages">{rows.map(row => <article key={row.id}><strong>{row.author?.username || "Kullanıcı"}</strong><div>{Parser.parse(row.content || "")}</div>{row.attachments?.map((file, i) => <small key={i}>📎 {file.filename} </small>)}</article>)}</div></aside>;
}
