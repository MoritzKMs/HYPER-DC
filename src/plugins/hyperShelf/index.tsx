/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton } from "@api/ChatButtons";
import { hyperTranslate as t } from "@utils/hyperLanguage";
import { ToolIcon, usePersonalItems } from "@utils/hyperTools";
import { PersonalItem } from "@utils/hyperTools/core";
import definePlugin from "@utils/types";
import { ChannelStore, closeModal, Modal, NavigationRouter, openModal, React } from "@webpack/common";

const Icon = () => <ToolIcon kind="bookmark" />;

function Shelf({ target, close }: { target?: PersonalItem; close: () => void; }) {
    const { rows, ready, busy, error, update } = usePersonalItems("HyperShelf");
    const [query, setQuery] = React.useState("");
    const [note, setNote] = React.useState("");
    const [saved, setSaved] = React.useState(false);
    const [editing, setEditing] = React.useState<string>();
    const [editedNote, setEditedNote] = React.useState("");
    const matches = rows.filter(row => `${row.text} ${ChannelStore.getChannel(row.channelId)?.name ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return <div className="hyper-tools">
        <p>{t("Save message links with personal notes. Message contents are not copied; deleted messages cannot be recovered.")}</p>
        {target && !saved && <form onSubmit={async event => {
            event.preventDefault();
            if (await update(current => {
                const existing = current.find(row => row.id === target.id);
                return [{ ...target, text: note.trim() || existing?.text || "" }, ...current.filter(row => row.id !== target.id)];
            })) setSaved(true);
        }}>
            <textarea aria-label={t("Personal note")} placeholder={t("Personal note")} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
            <button disabled={!ready || busy || (rows.length >= 500 && !rows.some(row => row.id === target.id))}>{t("Save to shelf")}</button>
        </form>}
        {saved && <p role="status">{t("Message link saved.")}</p>}
        <form onSubmit={event => event.preventDefault()}><input type="text" aria-label={t("Search notes or channels")} placeholder={t("Search notes or channels")} value={query} onChange={e => setQuery(e.target.value)} /></form>
        {error && <p role="alert">{error}</p>}
        {!ready && !error && <p>{t("Loading…")}</p>}
        {ready && !matches.length && <p>{t("No saved links found.")}</p>}
        {rows.length >= 500 && <p>{t("Storage is full (500 entries). Remove an entry before adding another.")}</p>}
        <div className="hyper-tools-list">{matches.map(row => <article key={row.id}>
            <small>#{ChannelStore.getChannel(row.channelId)?.name || row.channelId}</small>
            {editing === row.id ? <form onSubmit={async event => {
                event.preventDefault();
                if (await update(current => current.map(item => item.id === row.id ? { ...item, text: editedNote.trim() } : item))) setEditing(undefined);
            }}><textarea aria-label={t("Personal note")} maxLength={1000} value={editedNote} onChange={e => setEditedNote(e.target.value)} /><button disabled={busy}>{t("Save note")}</button><button type="button" onClick={() => setEditing(undefined)}>{t("Cancel")}</button></form>
                : <p>{row.text || t("No note added.")}</p>}
            <div className="hyper-tools-actions">
                <button onClick={() => { close(); NavigationRouter.transitionTo(`/channels/${row.guildId || "@me"}/${row.channelId}/${row.messageId}`); }}>{t("Go to message")}</button>
                <button onClick={() => { setEditing(row.id); setEditedNote(row.text); }}>{t("Edit note")}</button>
                <button disabled={busy} onClick={() => void update(current => current.filter(item => item.id !== row.id))}>{t("Delete")}</button>
            </div>
        </article>)}</div>
    </div>;
}

function openShelf(target?: PersonalItem) {
    closeModal("hyper-shelf");
    openModal(props => <Modal {...props} title="HyperShelf"><Shelf target={target} close={props.onClose} /></Modal>, { modalKey: "hyper-shelf" });
}

export default definePlugin({
    name: "HyperShelf",
    description: t("A private message-link shelf with searchable personal notes."),
    authors: [{ name: "HyperDC", id: 0n }],
    tags: ["Organisation", "Chat"],
    enabledByDefault: true,
    chatBarButton: { icon: Icon, render: ({ isAnyChat }) => isAnyChat ? <ChatBarButton tooltip={t("Message shelf")} onClick={() => openShelf()}><Icon /></ChatBarButton> : null },
    messagePopoverButton: {
        icon: Icon,
        render(message) {
            const channel = ChannelStore.getChannel(message.channel_id);
            if (!channel || !/^\d+$/.test(message.id)) return null;
            return { label: t("Save to shelf"), icon: Icon, message, channel, onClick: () => openShelf({ id: `${channel.id}:${message.id}`, channelId: channel.id, guildId: channel.guild_id || undefined, messageId: message.id, text: "", done: false }) };
        }
    },
    settingsAboutComponent: () => <div className="hyper-tools"><p>{t("Use the bookmark button on a message to save its link, then open your shelf beside the message box.")}</p><button onClick={() => openShelf()}>{t("Message shelf")}</button></div>,
    toolboxActions: { [t("Message shelf")]: () => openShelf() },
    stop() { closeModal("hyper-shelf"); }
});
