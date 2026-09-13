/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { hyperTranslate } from "@utils/hyperLanguage";
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const isVirtualDevice = (label: string) => /cable|voicemeeter|virtual|blackhole/i.test(label);

export class DeckAudio {
    readonly audio = new Audio();
    readonly context = new AudioContext();
    readonly analyser = this.context.createAnalyser();
    readonly bass = this.context.createBiquadFilter();
    readonly limiter = this.context.createDynamicsCompressor();
    readonly monitor = this.context.createGain();
    readonly send = this.context.createGain();
    readonly destination = this.context.createMediaStreamDestination();
    readonly output = new Audio() as HTMLAudioElement & { setSinkId(id: string): Promise<void>; };
    private url?: string;
    private generation = 0;
    private disposed = false;
    private mic?: MediaStream;
    private micSource?: MediaStreamAudioSourceNode;

    constructor() {
        const source = this.context.createMediaElementSource(this.audio);
        this.analyser.fftSize = 256;
        this.bass.type = "lowshelf";
        this.bass.frequency.value = 160;
        this.bass.gain.value = 0;
        this.limiter.threshold.value = -3;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.15;
        source.connect(this.bass).connect(this.limiter).connect(this.analyser);
        this.analyser.connect(this.monitor).connect(this.context.destination);
        this.analyser.connect(this.send).connect(this.destination);
        this.send.gain.value = 0;
        this.output.srcObject = this.destination.stream;
        this.audio.volume = 0.5;
    }

    load(file: File) {
        if (!/\.mp3$/i.test(file.name) || file.size === 0 || file.size > 100 * 1024 * 1024)
            throw new Error(hyperTranslate("Select a non-empty MP3 no larger than 100 MB."));
        this.disableSend();
        this.audio.pause();
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = URL.createObjectURL(file);
        this.audio.src = this.url;
        this.audio.load();
    }

    async enableSend(deviceId: string, micId: string, allowed: () => boolean) {
        this.disableSend();
        const { generation } = this;
        if (!allowed()) throw new Error(hyperTranslate("Join a voice channel and unmute your microphone first."));
        if (!this.output.setSinkId) throw new Error(hyperTranslate("This Discord version does not support selecting an audio output."));
        const devices = await navigator.mediaDevices.enumerateDevices();
        const device = devices.find(d => d.kind === "audiooutput" && d.deviceId === deviceId);
        if (!device || !isVirtualDevice(device.label) || deviceId === "default")
            throw new Error(hyperTranslate("Select a virtual audio output such as VB-CABLE or VoiceMeeter."));
        const valid = () => !this.disposed && generation === this.generation && allowed();
        if (!valid()) return false;
        await this.output.setSinkId(deviceId);
        if (!valid()) return false;
        await this.context.resume();
        if (micId) {
            const input = devices.find(d => d.kind === "audioinput" && d.deviceId === micId);
            if (!input || micId === "default" || isVirtualDevice(input.label))
                throw new Error(hyperTranslate("Select a physical microphone for microphone mixing."));
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId } }, video: false });
            if (!valid()) { stream.getTracks().forEach(t => t.stop()); return false; }
            this.mic = stream;
            this.micSource = this.context.createMediaStreamSource(stream);
            this.micSource.connect(this.destination);
        }
        if (!valid()) { this.disableSend(); return false; }
        await this.output.play();
        if (!valid()) { this.disableSend(); return false; }
        this.send.gain.value = 1;
        return true;
    }

    disableSend() {
        this.generation++;
        this.send.gain.value = 0;
        this.output.pause();
        this.micSource?.disconnect();
        this.mic?.getTracks().forEach(t => t.stop());
        this.micSource = undefined;
        this.mic = undefined;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.disableSend();
        this.audio.pause();
        this.audio.removeAttribute("src");
        this.audio.load();
        this.output.srcObject = null;
        this.destination.stream.getTracks().forEach(t => t.stop());
        if (this.url) URL.revokeObjectURL(this.url);
        void this.context.close();
    }
}
