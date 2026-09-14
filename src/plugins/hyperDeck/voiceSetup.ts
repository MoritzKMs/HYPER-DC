/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { hyperTranslate } from "@utils/hyperLanguage";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore } from "@webpack/common";

const actions = findByPropsLazy("setInputDevice", "setMode", "setNoiseCancellation");
const backupKey = "HyperDeck:VoiceSetupBackup:v1";

interface VoiceBackup {
    input: string;
    mode: ReturnType<typeof MediaEngineStore.getMode>;
    options: ReturnType<typeof MediaEngineStore.getModeOptions>;
    cancellation: boolean;
    suppression: boolean;
    echo: boolean;
    gain: boolean;
}

export async function hasVoiceBackup(key = backupKey) {
    return !!await DataStore.get<VoiceBackup>(key);
}

export async function restoreVoiceSetup(key = backupKey) {
    const saved = await DataStore.get<VoiceBackup>(key);
    if (!saved) return;
    actions.setInputDevice(saved.input);
    actions.setMode(saved.mode, saved.options);
    actions.setNoiseCancellation(saved.cancellation);
    actions.setNoiseSuppression(saved.suppression);
    actions.setEchoCancellation(saved.echo);
    actions.setAutomaticGainControl(saved.gain);
    await DataStore.del(key);
}

export async function applyVoiceSetup(devices: MediaDeviceInfo[], selectedSink: string, key = backupKey) {
    const outputs = devices.filter(d => d.kind === "audiooutput" && /\bCABLE(?:-[AB])? Input\b/i.test(d.label) && d.deviceId !== "default" && d.deviceId !== "communications");
    const output = outputs.find(d => d.deviceId === selectedSink) ?? (outputs.length === 1 ? outputs[0] : undefined);
    if (!output) throw new Error(outputs.length > 1 ? hyperTranslate("Multiple CABLE devices found. Select the virtual output first.") : hyperTranslate("CABLE Input was not found. Install VB-CABLE and allow device access."));
    const cableName = output.label.match(/\b(CABLE(?:-[AB])?) Input\b/i)![1];
    const input = Object.values(MediaEngineStore.getInputDevices()).find(d => !d.disabled && d.index !== -1 && new RegExp(`\\b${cableName} Output\\b`, "i").test(d.name));
    if (!input) throw new Error(hyperTranslate("The matching CABLE Output microphone was not found in Discord. Restart Discord and try again."));
    for (const method of ["setInputDevice", "setMode", "setNoiseCancellation", "setNoiseSuppression", "setEchoCancellation", "setAutomaticGainControl"])
        if (typeof actions[method] !== "function") throw new Error(hyperTranslate("Voice settings cannot be changed in this Discord version."));

    if (!await hasVoiceBackup(key)) await DataStore.set(key, {
        input: MediaEngineStore.getInputDeviceId(),
        mode: MediaEngineStore.getMode(),
        options: { ...MediaEngineStore.getModeOptions() },
        cancellation: MediaEngineStore.getNoiseCancellation(),
        suppression: MediaEngineStore.getNoiseSuppression(),
        echo: MediaEngineStore.getEchoCancellation(),
        gain: MediaEngineStore.getAutomaticGainControl()
    } satisfies VoiceBackup);
    try {
        actions.setInputDevice(input.id);
        actions.setNoiseCancellation(false);
        actions.setNoiseSuppression(false);
        actions.setEchoCancellation(false);
        actions.setAutomaticGainControl(false);
        actions.setMode("VOICE_ACTIVITY", { ...MediaEngineStore.getModeOptions(), autoThreshold: false, threshold: -100, vadUseKrisp: false });
    } catch (error) {
        await restoreVoiceSetup(key);
        throw error;
    }
    return output.deviceId;
}
