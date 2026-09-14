/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@utils/hyperTools/style.css";
import "./style.css";

import { ChatBarButton } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { ChannelStore, closeModal, MediaEngineStore, Menu, Modal, openModal, React, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

import { audioChanged, audioRevision, AudioTools, deviceChanged, peakWarning, stopAlarm, stopAudio, stopGuard, stopMeter, subscribeAudio } from "./audio";
import { closeSideChat, openSideChat } from "./chat";
import { OCR } from "./ocr";
import { Zoom } from "./zoom";

const settings = definePluginSettings({
    alarm: { type: OptionType.BOOLEAN, description: "Ses kanalı bekleme alarmı", default: true, onChange: stopAlarm },
    meter: { type: OptionType.BOOLEAN, description: "Mikrofon taşması ölçümünü kullan (menüden başlatılır)", default: true, onChange: stopMeter },
    guard: { type: OptionType.BOOLEAN, description: "Kulaklık bağlantısı korumasını kullan (menüden başlatılır)", default: true, onChange: stopGuard },
    zoom: { type: OptionType.BOOLEAN, description: "Yayın yakınlaştırma", default: true, onChange: () => closeModal("hyper-extras") },
    chat: { type: OptionType.BOOLEAN, description: "Yan yana sohbet paneli", default: true, onChange: closeSideChat },
    ocr: { type: OptionType.BOOLEAN, description: "Windows ile görselden yazı alma", default: true, onChange: () => closeModal("hyper-extras") }
});
function Icon() { React.useSyncExternalStore(subscribeAudio, audioRevision); return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={peakWarning ? "#ff713e" : "currentColor"} strokeWidth="2"><path d={peakWarning ? "M12 3 2 21h20L12 3zm0 5v7m0 2v2" : "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm13 0v6m-3-3h6"} /></svg>; }
const Button = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");
function Panel({ initialChannel, address }: { initialChannel?: string; address?: string; }) {
    const options = settings.use(["alarm", "meter", "guard", "zoom", "chat", "ocr"]);
    const [tab, setTab] = React.useState(address ? "ocr" : "audio");
    return <div className="hyper-tools"><div className="hyper-tools-actions"><button onClick={() => setTab("audio")}>Ses araçları</button>{options.zoom && <button onClick={() => setTab("zoom")}>Yayın büyüt</button>}{options.ocr && <button onClick={() => setTab("ocr")}>Görselden yazı</button>}{options.chat && <button onClick={() => { const id = SelectedChannelStore.getChannelId(); if (id) { closeModal("hyper-extras"); openSideChat(id); } }}>Bu kanalı yan panelde aç</button>}</div>{tab === "audio" && <AudioTools meter={options.meter} guard={options.guard} wait={options.alarm} initialChannel={initialChannel} />}{tab === "zoom" && options.zoom && <Zoom />}{tab === "ocr" && options.ocr && <OCR address={address} />}</div>;
}
function openPanel(initialChannel?: string, address?: string) { closeModal("hyper-extras"); openModal(props => <Modal {...props} title="HyperDC · Ek araçlar"><Panel initialChannel={initialChannel} address={address} /></Modal>, { modalKey: "hyper-extras" }); }
function ExtraButton(props: { nameplate?: unknown; }) { return <Button tooltipText="HyperDC · Ek araçlar" icon={Icon} plated={props?.nameplate != null} onClick={() => openPanel()} />; }
export default definePlugin({
    name: "HyperExtras",
    description: "Ses alarmı, mikrofon seviye uyarısı, kulaklık koruması, yayın büyütme, yan sohbet ve görselden yazı alma.",
    authors: [{ name: "HyperDC", id: 0n }],
    enabledByDefault: true,
    settings,
    patches: [{ find: "#{intl::USER_PROFILE_ACCOUNT_POPOUT_BUTTON_A11Y_LABEL}", replacement: { match: /(\(0,\i\.jsx\)\(\i,\{accountContainerRef:)/, replace: "$self.ExtraButton(arguments[0]),$1" } }],
    ExtraButton: ErrorBoundary.wrap(ExtraButton, { noop: true }),
    chatBarButton: { icon: Icon, render: ({ isAnyChat }) => isAnyChat ? <ChatBarButton tooltip="HyperDC · Ek araçlar" onClick={() => openPanel()}><Icon /></ChatBarButton> : null },
    contextMenus: {
        "channel-context": (children, props) => {
            const { channel } = props;
            if (!channel) return;
            if (settings.store.alarm && channel.isGuildVocal()) children.push(<Menu.MenuItem id="hyper-wait" label="HyperDC · Ses kanalı alarmı" action={() => openPanel(channel.id)} />);
            if (settings.store.chat && !channel.isGuildVocal() && !channel.isCategory() && !channel.isForumPost?.() && channel.type !== 15 && channel.type !== 16) children.push(<Menu.MenuItem id="hyper-side" label="HyperDC · Yan panelde aç" action={() => openSideChat(channel.id)} />);
        },
        "image-context": (children, props) => {
            if (!settings.store.ocr) return;
            const address = props.src || props.target?.src;
            if (typeof address === "string") children.push(<Menu.MenuItem id="hyper-ocr" label="HyperDC · Görselden yazı al" action={() => openPanel(undefined, address)} />);
        }
    },
    settingsAboutComponent: () => <div className="hyper-tools"><p>Ses araçları sen açınca çalışır. Kanal ve görsellerin sağ tık menüsünde de kısayollar bulunur.</p><button onClick={() => openPanel()}>Ek araçları aç</button></div>,
    toolboxActions: { "HyperDC · Ek araçlar": () => openPanel() },
    start() { VoiceStateStore.addChangeListener(audioChanged); UserStore.addChangeListener(audioChanged); SelectedChannelStore.addChangeListener(audioChanged); MediaEngineStore.addChangeListener(audioChanged); ChannelStore.addChangeListener(audioChanged); navigator.mediaDevices.addEventListener("devicechange", deviceChanged); },
    stop() { VoiceStateStore.removeChangeListener(audioChanged); UserStore.removeChangeListener(audioChanged); SelectedChannelStore.removeChangeListener(audioChanged); MediaEngineStore.removeChangeListener(audioChanged); ChannelStore.removeChangeListener(audioChanged); navigator.mediaDevices.removeEventListener("devicechange", deviceChanged); stopAudio(); closeSideChat(); closeModal("hyper-extras"); }
});
