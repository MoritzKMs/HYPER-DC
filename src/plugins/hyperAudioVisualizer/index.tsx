/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin, { PluginNative } from "@utils/types";
import { React } from "@webpack/common";

import style from "./style.css?managed";

const cleanups = new Set<() => void>();
interface Player {
    mediaRef: { current: HTMLMediaElement | null; };
    props: { fileName?: string; src?: string; };
}
function Visualizer({ player }: { player: Player; }) {
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = React.useState("Oynatinca ses analizi baslar");
    React.useEffect(() => {
        const audio = player.mediaRef.current;
        if (!audio || audio.tagName !== "AUDIO") return;
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        const silent = context.createGain();
        silent.gain.value = 0;
        analyser.connect(silent).connect(context.destination);
        const abort = new AbortController();
        let buffer: AudioBuffer | undefined;
        let loading: Promise<void> | undefined;
        let source: AudioBufferSourceNode | undefined;
        let alive = true;
        let frame = 0;
        let epoch = 0;
        const bins = new Uint8Array(analyser.frequencyBinCount);
        const stopSource = () => {
            epoch++;
            cancelAnimationFrame(frame);
            source?.stop(); source?.disconnect(); source = undefined;
            canvas.current?.getContext("2d")?.clearRect(0, 0, 640, 64);
        };
        const load = async () => {
            if (IS_DISCORD_DESKTOP) {
                const native = VencordNative.pluginHelpers.HyperAudioVisualizer as PluginNative<typeof import("./native")>;
                if (!native?.readAttachment) throw new Error(hyperTranslate("Fully close and reopen Discord to load the new package."));
                const bytes = await native.readAttachment(audio.currentSrc || player.props.src || "");
                if (!alive) return;
                buffer = await context.decodeAudioData(new Uint8Array(bytes).buffer);
                return;
            }
            const response = await fetch(audio.currentSrc || player.props.src || "", { signal: abort.signal, credentials: "omit" });
            if (!response.ok) throw new Error("Ses dosyasi okunamadi");
            const limit = 25 * 1024 * 1024;
            if (Number(response.headers.get("content-length")) > limit) throw new Error("Gorsellestirici siniri: 25 MB");
            const reader = response.body?.getReader();
            if (!reader) throw new Error("Ses verisi okunamadi");
            const chunks: Uint8Array[] = [];
            let total = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.length;
                if (total > limit) { await reader.cancel(); throw new Error("Gorsellestirici siniri: 25 MB"); }
                chunks.push(value);
            }
            const bytes = new Uint8Array(total);
            let offset = 0;
            chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length; });
            buffer = await context.decodeAudioData(bytes.buffer);
        };
        const draw = () => {
            if (!alive || audio.paused || audio.ended) return;
            analyser.getByteFrequencyData(bins);
            const ctx = canvas.current?.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, 640, 64);
                for (let i = 0; i < 64; i++) {
                    const height = Math.max(2, bins[i * 2] / 255 * 60);
                    ctx.fillStyle = `hsl(${20 + i / 3} 95% 60%)`;
                    ctx.fillRect(i * 10 + 1, 64 - height, 6, height);
                }
            }
            frame = requestAnimationFrame(draw);
        };
        const play = async () => {
            stopSource();
            const current = epoch;
            try {
                setStatus("Ses analiz ediliyor...");
                await context.resume();
                loading ??= load();
                await loading;
                if (!alive || current !== epoch || audio.paused || !buffer) return;
                source = context.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = audio.playbackRate;
                source.connect(analyser);
                source.start(0, Math.min(audio.currentTime, buffer.duration));
                setStatus("");
                draw();
            } catch (error) { if (alive) { loading = undefined; setStatus(error instanceof Error ? error.message : "Ses analizi baslatilamadi"); } }
        };
        const pause = () => { stopSource(); if (alive) setStatus("Duraklatildi"); };
        audio.addEventListener("play", play);
        audio.addEventListener("seeked", play);
        audio.addEventListener("ratechange", play);
        audio.addEventListener("pause", pause);
        audio.addEventListener("ended", pause);
        const stop = () => {
            if (!alive) return;
            alive = false; abort.abort(); stopSource();
            audio.removeEventListener("play", play);
            audio.removeEventListener("seeked", play);
            audio.removeEventListener("ratechange", play);
            audio.removeEventListener("pause", pause);
            audio.removeEventListener("ended", pause);
            void context.close();
        };
        cleanups.add(stop);
        if (!audio.paused) void play();
        return () => { cleanups.delete(stop); stop(); };
    }, [player.props.src]);
    return <div className="hyper-attachment-viz"><canvas ref={canvas} width={640} height={64} role="img" aria-label={hyperTranslate("MP3 frekans gorsellestiricisi")} />{status && <small>{status}</small>}</div>;
}
const SafeVisualizer = ErrorBoundary.wrap(Visualizer, { noop: true });

export default definePlugin({
    name: "HyperAudioVisualizer",
    description: hyperTranslate("Live audio visualizer above the progress bar of MP3 attachments in chat."),
    authors: [{ name: "HYPER DC", id: 0n }],
    enabledByDefault: true,
    managedStyle: style,
    patches: [{
        find: "renderAudio(){",
        replacement: {
            match: /children:this\.renderControls\(\)/,
            replace: "children:[$self.renderVisualizer(this),this.renderControls()]"
        }
    }],
    renderVisualizer(player: Player) {
        return /\.mp3(?:$|[?#])/i.test([player.props.fileName, player.props.src].filter(Boolean).join("?"))
            ? <SafeVisualizer key="hyper-audio-visualizer" player={player} /> : null;
    },
    stop() { cleanups.forEach(cleanup => cleanup()); cleanups.clear(); }
});
