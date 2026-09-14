/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton } from "@api/ChatButtons";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { hyperTranslate as t } from "@utils/hyperLanguage";
import { ToolIcon } from "@utils/hyperTools";
import { Countdown, pauseCountdown, remainingTime, resumeCountdown } from "@utils/hyperTools/core";
import definePlugin, { OptionType } from "@utils/types";
import { closeModal, Modal, openModal, React, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    duration: { type: OptionType.SELECT, description: t("Focus session length"), options: [
        { label: t("15 minutes"), value: 15 }, { label: t("25 minutes"), value: 25, default: true }, { label: t("45 minutes"), value: 45 }, { label: t("60 minutes"), value: 60 }
    ] },
    breakDuration: { type: OptionType.SELECT, description: t("Break length"), options: [
        { label: t("5 minutes"), value: 5, default: true }, { label: t("10 minutes"), value: 10 }, { label: t("15 minutes"), value: 15 }
    ] }
});
let timer: Countdown = { remaining: 0, deadline: null };
let phase: "idle" | "focus" | "break" | "finished" = "idle";
let completed = 0;
let owner: string | undefined;
let interval: ReturnType<typeof setInterval>;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => { revision++; listeners.forEach(fn => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const Icon = () => <ToolIcon kind="clock" />;
function reset() { timer = { remaining: 0, deadline: null }; phase = "idle"; emit(); }
function tick() {
    const id = UserStore.getCurrentUser()?.id;
    if (owner !== id) { owner = id; completed = 0; reset(); return; }
    if (timer.deadline !== null && remainingTime(timer, Date.now()) === 0) {
        const wasFocus = phase === "focus";
        if (wasFocus) completed++;
        timer = { remaining: 0, deadline: null };
        phase = "finished";
        showNotification({ title: "HyperFocus", body: t(wasFocus ? "Focus session complete. Time for a break." : "Break finished. Ready for the next session?"), onClick: openFocus });
    }
    if (phase !== "idle") emit();
}
function begin(next: "focus" | "break") {
    owner = UserStore.getCurrentUser()?.id;
    if (!owner) return;
    phase = next;
    timer = resumeCountdown({ remaining: (next === "focus" ? settings.store.duration : settings.store.breakDuration) * 60000, deadline: null }, Date.now());
    emit();
}
function Focus() {
    React.useSyncExternalStore(subscribe, () => revision);
    settings.use(["duration", "breakDuration"]);
    const seconds = Math.ceil(remainingTime(timer, Date.now()) / 1000);
    const active = phase === "focus" || phase === "break";
    return <div className="hyper-tools">
        <p>{t("A personal focus timer. Continues when this window closes; ends when Discord closes or the plugin is disabled.")}</p>
        <strong>{t(phase === "focus" ? "Focus session" : phase === "break" ? "Break" : phase === "finished" ? "Session complete" : "Ready to focus")}</strong>
        <output className="hyper-tools-time" aria-label={t("Time remaining")}>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</output>
        <div className="hyper-tools-actions">
            <label>{t("Focus session length")} <select disabled={active} value={settings.store.duration} onChange={e => { settings.store.duration = Number(e.target.value); }}>{[15, 25, 45, 60].map(n => <option key={n} value={n}>{t(`${n} minutes`)}</option>)}</select></label>
            <label>{t("Break length")} <select disabled={active} value={settings.store.breakDuration} onChange={e => { settings.store.breakDuration = Number(e.target.value); }}>{[5, 10, 15].map(n => <option key={n} value={n}>{t(`${n} minutes`)}</option>)}</select></label>
        </div>
        <div className="hyper-tools-actions">
            {!active && <><button onClick={() => begin("focus")}>{t("Start focus session")}</button><button onClick={() => begin("break")}>{t("Take a break")}</button></>}
            {active && <><button onClick={() => { timer = timer.deadline === null ? resumeCountdown(timer, Date.now()) : pauseCountdown(timer, Date.now()); emit(); }}>{t(timer.deadline === null ? "Resume" : "Pause")}</button><button onClick={reset}>{t("Stop")}</button></>}
        </div>
        <small>{t("Completed sessions this time")}: {completed}</small>
    </div>;
}
function openFocus() { openModal(props => <Modal {...props} title="HyperFocus"><Focus /></Modal>, { modalKey: "hyper-focus" }); }

export default definePlugin({
    name: "HyperFocus",
    description: t("Focus sessions and break reminders without changing your Discord status or sound settings."),
    authors: [{ name: "HyperDC", id: 0n }],
    tags: ["Utility", "Notifications"],
    enabledByDefault: true,
    settings,
    chatBarButton: { icon: Icon, render: ({ isAnyChat }) => isAnyChat ? <ChatBarButton tooltip={t("Focus timer")} onClick={openFocus}><Icon /></ChatBarButton> : null },
    settingsAboutComponent: () => <div className="hyper-tools"><button onClick={openFocus}>{t("Focus timer")}</button></div>,
    toolboxActions: { [t("Focus timer")]: openFocus },
    start() { owner = UserStore.getCurrentUser()?.id; interval = setInterval(tick, 1000); },
    stop() { clearInterval(interval); completed = 0; reset(); closeModal("hyper-focus"); }
});
