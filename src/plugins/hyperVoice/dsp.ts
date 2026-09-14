/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const processorSource = `
class HyperVoiceProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(Math.ceil(sampleRate * 0.2));
        this.write = 0;
        this.phase = 0;
        this.robotPhase = 0;
        this.mode = 'normal';
        this.low = 0;
        this.high = 0;
        this.port.onmessage = event => { this.mode = event.data; };
    }
    sample(delay) {
        const n = this.buffer.length;
        const pos = (this.write - delay + n) % n;
        const i = Math.floor(pos);
        return this.buffer[i] * (1 - (pos - i)) + this.buffer[(i + 1) % n] * (pos - i);
    }
    process(inputs, outputs) {
        const input = inputs[0]?.[0];
        const output = outputs[0]?.[0];
        if (!output) return true;
        const semitones = { bright: 5, deep: -5, chipmunk: 10, monster: -10, alien: 7 }[this.mode] || 0;
        const ratio = Math.pow(2, semitones / 12);
        const span = sampleRate * 0.06;
        for (let i = 0; i < output.length; i++) {
            const value = input?.[i] || 0;
            this.buffer[this.write] = value;
            let result = value;
            if (ratio !== 1) {
                const p = this.phase;
                const q = (p + 0.5) % 1;
                const weight = 0.5 - 0.5 * Math.cos(p * 2 * Math.PI);
                result = this.sample(128 + span * p) * weight + this.sample(128 + span * q) * (1 - weight);
                this.phase = (p + (1 - ratio) / span + 1) % 1;
            }
            if (this.mode === 'robot' || this.mode === 'alien') {
                result *= Math.sin(this.robotPhase * 2 * Math.PI);
            }
            if (this.mode === 'radio') {
                this.low += (1 - Math.exp(-2 * Math.PI * 3000 / sampleRate)) * (value - this.low);
                this.high += (1 - Math.exp(-2 * Math.PI * 400 / sampleRate)) * (this.low - this.high);
                result = Math.tanh((this.low - this.high) * 3) * 0.65;
            }
            if (this.mode === 'echo') result = value * 0.7 + this.sample(sampleRate * 0.12) * 0.3;
            this.robotPhase = (this.robotPhase + 45 / sampleRate) % 1;
            output[i] = Math.max(-1, Math.min(1, result));
            this.write = (this.write + 1) % this.buffer.length;
        }
        return true;
    }
}
registerProcessor('hyper-voice', HyperVoiceProcessor);
`;
