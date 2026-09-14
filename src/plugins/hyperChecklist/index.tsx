/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton } from "@api/ChatButtons";
import { hyperTranslate as t } from "@utils/hyperLanguage";
import { ToolIcon, usePersonalItems } from "@utils/hyperTools";
import definePlugin from "@utils/types";
import { ChannelStore, closeModal, Modal, openModal, React, SelectedChannelStore } from "@webpack/common";

function Checklist({ channelId }: { channelId: string; }) {
    const { rows, ready, busy, error, update } = usePersonalItems("HyperChecklist");
    const [text, setText] = React.useState("");
    const [hideDone, setHideDone] = React.useState(false);
    const items = rows.filter(row => row.channelId === channelId);
    return <div className="hyper-tools">
        <p>{t("Your private checklist for this channel. Only stored on this device.")}</p>
        <form onSubmit={async event => {
            event.preventDefault();
            const value = text.trim();
            if (!value || rows.length >= 500) return;
            if (await update(current => [...current, { id: crypto.randomUUID(), channelId, text: value, done: false }])) setText("");
        }}>
            <input type="text" aria-label={t("New task")} placeholder={t("New task")} maxLength={1000} value={text} onChange={e => setText(e.target.value)} />
            <button disabled={!ready || busy || !text.trim() || rows.length >= 500}>{t("Add task")}</button>
        </form>
        <small>{items.filter(row => row.done).length} / {items.length} · {t("Completed")}</small>
        <p><label><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} /> {t("Hide completed tasks")}</label></p>
        {error && <p role="alert">{error}</p>}
        {!ready && !error && <p>{t("Loading…")}</p>}
        {rows.length >= 500 && <p>{t("Storage is full (500 entries). Remove an entry before adding another.")}</p>}
        {ready && !items.length && <p>{t("No tasks in this channel yet.")}</p>}
        <div className="hyper-tools-list">{items.filter(row => !hideDone || !row.done).map(row => <article key={row.id}>
            <label><input type="checkbox" disabled={busy} checked={row.done} onChange={() => void update(current => current.map(item => item.id === row.id ? { ...item, done: !item.done } : item))} />
                <span className={row.done ? "hyper-tools-complete" : ""}>{row.text}</span></label>
            <div className="hyper-tools-actions"><button disabled={busy} onClick={() => void update(current => current.filter(item => item.id !== row.id))}>{t("Delete")}</button></div>
        </article>)}</div>
    </div>;
}

function openChecklist(channelId = SelectedChannelStore.getChannelId()) {
    if (!channelId) return;
    openModal(props => <Modal {...props} title={`HyperChecklist · ${ChannelStore.getChannel(channelId)?.name || t("Current channel")}`}><Checklist channelId={channelId} /></Modal>, { modalKey: "hyper-checklist" });
}

export default definePlugin({
    name: "HyperChecklist",
    description: t("Private per-channel task lists with completion tracking."),
    authors: [{ name: "HyperDC", id: 0n }],
    tags: ["Organisation", "Utility"],
    enabledByDefault: true,
    chatBarButton: {
        icon: ToolIcon,
        render: ({ channel, isAnyChat }) => isAnyChat ? <ChatBarButton tooltip={t("Channel checklist")} onClick={() => openChecklist(channel.id)}><ToolIcon /></ChatBarButton> : null
    },
    settingsAboutComponent: () => <div className="hyper-tools"><p>{t("Open the checklist from the checkmark button beside the message box.")}</p><button onClick={() => openChecklist()}>{t("Channel checklist")}</button></div>,
    toolboxActions: { [t("Channel checklist")]: () => openChecklist() },
    stop() { closeModal("hyper-checklist"); }
});
