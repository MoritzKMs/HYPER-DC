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
        source.connect(this.analyser);
        this.analyser.connect(this.monitor).connect(this.context.destination);
        this.analyser.connect(this.send).connect(this.destination);
        this.send.gain.value = 0;
        this.output.srcObject = this.destination.stream;
        this.audio.volume = 0.5;
    }

    load(file: File) {
        if (!/\.mp3$/i.test(file.name) || file.size === 0 || file.size > 100 * 1024 * 1024)
            throw new Error("En fazla 100 MB boyutunda, boş olmayan bir MP3 seç.");
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
        if (!allowed()) throw new Error("Önce bir ses kanalına katıl ve mikrofonunun susturmasını kaldır.");
        if (!this.output.setSinkId) throw new Error("Bu Discord sürümü ses çıkışı seçimini desteklemiyor.");
        const devices = await navigator.mediaDevices.enumerateDevices();
        const device = devices.find(d => d.kind === "audiooutput" && d.deviceId === deviceId);
        if (!device || !isVirtualDevice(device.label) || deviceId === "default")
            throw new Error("VB-CABLE / VoiceMeeter gibi bir sanal ses çıkışı seç.");
        const valid = () => !this.disposed && generation === this.generation && allowed();
        if (!valid()) return false;
        await this.output.setSinkId(deviceId);
        if (!valid()) return false;
        await this.context.resume();
        if (micId) {
            const input = devices.find(d => d.kind === "audioinput" && d.deviceId === micId);
            if (!input || micId === "default" || isVirtualDevice(input.label))
                throw new Error("Mikrofon karışımı için fiziksel mikrofonunu seç.");
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
