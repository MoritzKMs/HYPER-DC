/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function isMonitorOutput(device: Pick<MediaDeviceInfo, "kind" | "deviceId" | "label">) {
    return device.kind === "audiooutput" && !!device.deviceId && !!device.label
        && !["default", "communications"].includes(device.deviceId)
        && !/cable|voicemeeter|virtual|blackhole/i.test(device.label);
}

export class VoiceMonitor {
    private audio?: HTMLAudioElement;
    private generation = 0;
    stop() {
        this.generation++;
        this.audio?.pause();
        if (this.audio) this.audio.srcObject = null;
        this.audio = undefined;
    }
    setVolume(value: number) { if (this.audio) this.audio.volume = Math.min(1, Math.max(0, value)); }
    async start(stream: MediaStream, sink: string, volume: number) {
        this.stop();
        const token = this.generation;
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (token !== this.generation) return false;
        if (!devices.some(device => device.deviceId === sink && isMonitorOutput(device))) throw Error("Dinlemek için fiziksel kulaklık veya hoparlör seç. CABLE çıkışı kullanılamaz.");
        const audio = new Audio();
        this.audio = audio;
        if (!audio.setSinkId) { this.stop(); throw Error("Bu istemci dinleme çıkışı seçimini desteklemiyor."); }
        try {
            await audio.setSinkId(sink);
            if (token !== this.generation) return false;
            audio.srcObject = stream;
            this.setVolume(volume);
            await audio.play();
            if (token !== this.generation) { audio.pause(); audio.srcObject = null; return false; }
            return true;
        } catch (error) {
            if (token === this.generation) this.stop();
            throw error;
        }
    }
}
