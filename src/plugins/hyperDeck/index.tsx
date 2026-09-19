/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { hyperTranslate } from "@utils/hyperLanguage";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, React, ReactDOM, SelectedChannelStore, useStateFromStores } from "@webpack/common";

import { DeckAudio, isVirtualDevice } from "./audio";
import { LibraryTrack } from "./library";
import { downloadTrack } from "./libraryClient";
import { MusicLibrary } from "./MusicLibrary";
import { applyVoiceSetup, hasVoiceBackup, restoreVoiceSetup } from "./voiceSetup";


const noiseActions = findByPropsLazy("setNoiseCancellation", "setNoiseSuppression");



const sessions = new Set<() => void>();

const channel = () => SelectedChannelStore.getVoiceChannelId();

const canSend = () => !!channel() && !MediaEngineStore.isSelfMute() && !MediaEngineStore.isSelfDeaf();

const time = (s: number) => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";



function Player({ original }: { original: React.ReactNode; }) {

    const [autoNoise, setAutoNoise] = React.useState(false);
    const [voiceBackup, setVoiceBackup] = React.useState(false);
    React.useEffect(() => { void hasVoiceBackup().then(setVoiceBackup); }, []);
    const [bassBoost, setBassBoost] = React.useState(0);

    const noise = React.useRef<{ cancellation: boolean; suppression: boolean; } | null>(null);

    const restoreNoise = () => {

        if (!noise.current) return;

        try {

            noiseActions.setNoiseCancellation(noise.current.cancellation);

            noiseActions.setNoiseSuppression(noise.current.suppression);

            noise.current = null;

        } catch { setStatus(hyperTranslate("Could not restore noise processing. Check Discord voice settings.")); }

    };

    const [expanded, setExpanded] = React.useState(false);

    const [visualizer, setVisualizer] = React.useState(true);

    const smallCanvas = React.useRef<HTMLCanvasElement>(null);

    const trigger = React.useRef<HTMLButtonElement>(null);

    const dialog = React.useRef<HTMLDivElement>(null);

    const close = () => { setExpanded(false); trigger.current?.focus(); };

    React.useEffect(() => {

        if (expanded) dialog.current?.focus();

    }, [expanded]);

    const engine = React.useRef<DeckAudio | undefined>(undefined);

    const canvas = React.useRef<HTMLCanvasElement>(null);

    const [file, setFile] = React.useState("");

    const [status, setStatus] = React.useState(hyperTranslate("Start by choosing an MP3. The file stays on your device."));

    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);

    const [sink, setSink] = React.useState("");

    const [mic, setMic] = React.useState("");

    const [sending, setSending] = React.useState(false);

    const [busy, setBusy] = React.useState(false);
    const queue = React.useRef<LibraryTrack[]>([]);
    const generation = React.useRef(0);
    const nextTrack = React.useRef<() => void>(() => {});
    const [remaining, setRemaining] = React.useState(0);
    const [repeat, setRepeat] = React.useState(false);
    function clearQueue() { generation.current++; queue.current = []; setRemaining(0); setBusy(false); }
    async function advance() {
        const deck = engine.current;
        const track = queue.current.shift();
        setRemaining(queue.current.length);
        if (!deck || !track) return;
        const token = ++generation.current;
        const voiceAtStart = voice;
        const wasSending = sending;
        setBusy(true); setStatus(`Parça hazırlanıyor: ${track.title}`);
        try {
            const data = await downloadTrack(track);
            if (generation.current !== token || engine.current !== deck) return;
            deck.load(data); deck.audio.loop = false; setRepeat(false);
            setFile(track.title); setSending(false); setPosition(0); setDuration(0);
            await deck.context.resume();
            if (wasSending && canSend()) {
                const sent = await deck.enableSend(sink, mic, () => generation.current === token && engine.current === deck && canSend() && `${channel() ?? ""}:${canSend()}` === voiceAtStart);
                setSending(sent);
            }
            if (generation.current !== token || engine.current !== deck) return;
            await deck.audio.play(); setPlaying(true); setStatus(`Çalıyor: ${track.title}`);
        } catch { if (generation.current === token) { deck.disableSend(); setSending(false); setPlaying(false); setStatus("Parça yüklenemedi. Sonraki parça düğmesiyle devam edebilirsin."); } }
        finally { if (generation.current === token) setBusy(false); }
    }
    nextTrack.current = () => { void advance(); };

    const [playing, setPlaying] = React.useState(false);

    const [position, setPosition] = React.useState(0);

    const [duration, setDuration] = React.useState(0);

    const [volume, setVolume] = React.useState(50);

    const [monitor, setMonitor] = React.useState(true);

    const [disabled, setDisabled] = React.useState(false);

    const voice = useStateFromStores([SelectedChannelStore, MediaEngineStore], () => `${channel() ?? ""}:${canSend()}`);



    React.useEffect(() => {

        let alive = true;

        const deck = new DeckAudio();

        engine.current = deck;

        const refresh = () => navigator.mediaDevices.enumerateDevices().then(d => { if (alive) setDevices(d); }).catch(() => { if (alive) setStatus(hyperTranslate("Could not read audio devices.")); });

        const stop = () => { deck.disableSend(); deck.audio.pause(); if (alive) setSending(false); };

        const ended = () => { if (queue.current.length) nextTrack.current(); else { stop(); setPlaying(false); } };

        const error = () => { stop(); setPlaying(false); setStatus(hyperTranslate("Could not decode this MP3. Choose another file.")); };

        const update = () => { setPosition(deck.audio.currentTime); setDuration(deck.audio.duration || 0); setPlaying(!deck.audio.paused); };

        deck.audio.addEventListener("ended", ended);

        deck.audio.addEventListener("error", error);

        deck.audio.addEventListener("timeupdate", update);

        deck.audio.addEventListener("loadedmetadata", update);

        const changed = () => { stop(); setStatus(hyperTranslate("The audio device changed. Enable transmission again.")); void refresh(); };

        navigator.mediaDevices.addEventListener("devicechange", changed);

        const shutdown = () => { generation.current++; queue.current = []; stop(); restoreNoise(); deck.dispose(); engine.current = undefined; setDisabled(true); };

        sessions.add(shutdown);

        void refresh();

        let frame = 0;

        const bins = new Uint8Array(deck.analyser.frequencyBinCount);

        const draw = () => {

            deck.analyser.getByteFrequencyData(bins);

            for (const target of [canvas.current, smallCanvas.current]) {

                const ctx = target?.getContext("2d");

                if (!ctx || !target) continue;

                const { width, height } = target;

                ctx.clearRect(0, 0, width, height);

                for (let i = 0; i < 48; i++) {

                    const h = Math.max(2, bins[i * 2] / 255 * (height - 4));

                    ctx.fillStyle = `hsl(${22 + i / 3} 95% 60%)`;

                    ctx.fillRect(i * width / 48, height - h, Math.max(1, width / 48 - 2), h);

                }

            }

            frame = requestAnimationFrame(draw);

        };

        draw();

        return () => {

            restoreNoise();

            alive = false;
            generation.current++; queue.current = [];

            cancelAnimationFrame(frame);

            sessions.delete(shutdown);

            navigator.mediaDevices.removeEventListener("devicechange", changed);

            deck.audio.removeEventListener("ended", ended);

            deck.audio.removeEventListener("error", error);

            deck.audio.removeEventListener("timeupdate", update);

            deck.audio.removeEventListener("loadedmetadata", update);

            deck.dispose();

            engine.current = undefined;

        };

    }, []);



    React.useEffect(() => {

        engine.current?.disableSend();
        generation.current++; setBusy(false);

        setSending(false);

        if (!channel()) { engine.current?.audio.pause(); setPlaying(false); }

    }, [voice]);



    React.useEffect(() => {

        if (autoNoise && sending && playing && canSend()) {

            if (!noise.current) {

                noise.current = { cancellation: MediaEngineStore.getNoiseCancellation(), suppression: MediaEngineStore.getNoiseSuppression() };

                try { noiseActions.setNoiseCancellation(false); noiseActions.setNoiseSuppression(false); }

                catch { restoreNoise(); setStatus(hyperTranslate("Could not change noise processing.")); }

            }

        } else restoreNoise();

    }, [autoNoise, sending, playing, voice]);



    async function transmit(checked: boolean) {

        const deck = engine.current;

        if (!deck) return;

        if (!checked) { deck.disableSend(); setSending(false); return; }

        setBusy(true);

        const origin = channel();

        try {

            const ok = await deck.enableSend(sink, mic, () => canSend() && channel() === origin);

            if (engine.current !== deck) return;

            setSending(ok);

            setStatus(ok ? hyperTranslate("Virtual output enabled. Select the matching virtual microphone in Discord and ask someone to check the audio.") : hyperTranslate("Transmission cancelled."));

        } catch (e) {

            deck.disableSend();

            if (engine.current === deck) { setSending(false); setStatus(e instanceof Error ? e.message : hyperTranslate("Could not start transmission.")); }

        } finally { if (engine.current === deck) setBusy(false); }

    }



    const menu = <fieldset className="hyper-deck" disabled={disabled}>

        {disabled && <p>{hyperTranslate("Plugin disabled. Close the panel and enable the plugin again.")}</p>}

        <div className="hyper-deck-row"><h2 id="hyper-deck-dialog-title">{hyperTranslate("HYPER Deck")}</h2><button type="button" onClick={close}>{hyperTranslate("Close menu")}</button></div>

        <label className="hyper-deck-viz-switch"><input type="checkbox" checked={visualizer} onChange={e => setVisualizer(e.target.checked)} /> {hyperTranslate("Show the visualizer in the voice connection panel")}</label>

        <MusicLibrary busy={busy} setBusy={setBusy} setStatus={setStatus} onQueue={tracks => {
            clearQueue(); queue.current = [...tracks]; setRemaining(tracks.length);
            if (engine.current) { engine.current.audio.pause(); engine.current.audio.loop = false; }
            void advance();
        }} onLoad={(track, title) => {
            if (!engine.current) return;
            clearQueue();
            engine.current.load(track);
            setFile(title); setSending(false); setPlaying(false); setPosition(0); setDuration(0);
            setStatus(hyperTranslate("Ready. Press Play."));
        }} />
        <div className="hyper-deck-row"><span>Sırada: {remaining} parça</span><button disabled={busy || !remaining} onClick={() => { engine.current?.audio.pause(); void advance(); }}>Sonraki parça</button><button disabled={!remaining && !busy} onClick={clearQueue}>Sırayı temizle</button></div>
        <label className="hyper-deck-file">{hyperTranslate("Choose MP3")}<input type="file" accept=".mp3,audio/mpeg" disabled={busy} onChange={e => {

                const chosen = e.target.files?.[0];

                e.target.value = "";

                if (!chosen) return;
                clearQueue();

                try { engine.current?.load(chosen); setFile(chosen.name); setSending(false); setPlaying(false); setPosition(0); setDuration(0); setStatus(hyperTranslate("Ready. Press Play.")); }

                catch (error) { setStatus((error as Error).message); }

            }} />

        </label>

        <strong className="hyper-deck-title">{file || hyperTranslate("No track selected yet")}</strong>
        <small>HYPER Deck · 0.5.2</small>
        <canvas ref={canvas} width={640} height={140} role="img" aria-label={hyperTranslate("Music frequency visualizer")} />

        <div className="hyper-deck-row">

            <button disabled={!file} onClick={async () => {

                const deck = engine.current;

                if (!deck) return;

                if (!deck.audio.paused) { deck.audio.pause(); setPlaying(false); return; }

                try { await deck.context.resume(); await deck.audio.play(); if (engine.current === deck) setPlaying(true); }

                catch { setStatus(hyperTranslate("Could not start playback. Check the file and audio device.")); }

            }}>{playing ? hyperTranslate("Pause") : hyperTranslate("Play")}</button>

            <button onClick={() => { clearQueue(); const d = engine.current; if (d) { d.disableSend(); d.audio.pause(); d.audio.currentTime = 0; } setSending(false); setPlaying(false); }}>Durdur</button>

            <span>{time(position)} / {time(duration)}</span>

        </div>

        <input aria-label={hyperTranslate("Track position")} type="range" min={0} max={Number.isFinite(duration) ? duration : 0} step={0.1} value={position} onChange={e => { if (engine.current) engine.current.audio.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }} />

        <label>{hyperTranslate("Music volume · %")}{volume}<input type="range" min={0} max={100} value={volume} onChange={e => { const v = Number(e.target.value); setVolume(v); if (engine.current) engine.current.audio.volume = v / 100; }} /></label>

        <div className="hyper-deck-row">

            <label><input type="checkbox" checked={monitor} onChange={e => { setMonitor(e.target.checked); if (engine.current) engine.current.monitor.gain.value = e.target.checked ? 1 : 0; }} /> {hyperTranslate("Play locally too")}</label>

            <label><input type="checkbox" checked={repeat} disabled={remaining > 0 || busy} onChange={e => { setRepeat(e.target.checked); if (engine.current) engine.current.audio.loop = e.target.checked; }} /> {hyperTranslate("Repeat")}</label>

        </div>

        <div className="hyper-deck-effects">
            <label htmlFor="hyper-deck-bass"><strong>{hyperTranslate("BASS BOOST")}</strong><span>{bassBoost === 0 ? hyperTranslate("Off") : `+${bassBoost} dB`}</span></label>
            <input id="hyper-deck-bass" aria-label={hyperTranslate("Bass boost")} type="range" min={0} max={12} step={1} value={bassBoost} onChange={e => {
                const value = Number(e.target.value);
                setBassBoost(value);
                const deck = engine.current;
                if (deck) deck.bass.gain.setTargetAtTime(value, deck.context.currentTime, 0.04);
            }} />
            <div className="hyper-deck-bass-scale"><span>{hyperTranslate("Off")}</span><span>+6 dB</span><span>+12 dB</span></div>
            <label className="hyper-deck-noise"><input type="checkbox" checked={autoNoise} onChange={e => setAutoNoise(e.target.checked)} /> {hyperTranslate("Automatically disable noise processing")}</label>
            <small>{hyperTranslate("Krisp and standard noise suppression turn off during transmission. The previous settings return when paused, stopped or finished.")}</small>
        </div>
        <div className="hyper-deck-effects">
            <button disabled={busy || sending} onClick={async () => {
                setBusy(true);
                restoreNoise();
                setAutoNoise(false);
                try {
                    const available = await navigator.mediaDevices.enumerateDevices();
                    setDevices(available);
                    setSink(await applyVoiceSetup(available, sink));
                    setVoiceBackup(true);
                    setStatus(hyperTranslate("Settings applied: CABLE microphone, voice activity and open sensitivity. Krisp, noise suppression, echo cancellation and automatic gain are off. Choose an MP3 and enable Transmit to voice channel."));
                } catch (error) {
                    setStatus(error instanceof Error ? error.message : hyperTranslate("Could not apply voice settings."));
                } finally { setBusy(false); }
            }}>{hyperTranslate("Apply voice transmission settings")}</button>
            {voiceBackup && <button disabled={busy || sending} onClick={async () => {
                setBusy(true);
                restoreNoise();
                setAutoNoise(false);
                try { await restoreVoiceSetup(); setVoiceBackup(false); setStatus(hyperTranslate("Previous Discord voice settings restored.")); }
                catch { setStatus(hyperTranslate("Could not restore settings. Try again or check Discord voice settings.")); }
                finally { setBusy(false); }
            }}>{hyperTranslate("Restore previous voice settings")}</button>}
            <small>{hyperTranslate("Pairs CABLE Input with CABLE Output. Your microphone stays muted if you muted it. Settings remain applied until you restore them.")}</small>
        </div>
        <label>{hyperTranslate("Virtual audio output")}<select value={sink} disabled={sending || busy} onChange={e => setSink(e.target.value)}>
            <option value="">{hyperTranslate("Choose device")}</option>

            {devices.filter(d => d.kind === "audiooutput" && d.deviceId !== "default" && isVirtualDevice(d.label)).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}

        </select></label>

        <label>{hyperTranslate("Mix my microphone")}<select value={mic} disabled={sending || busy} onChange={e => setMic(e.target.value)}>

            <option value="">{hyperTranslate("Off · music only")}</option>

            {devices.filter(d => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications" && !isVirtualDevice(d.label) && d.label).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}

        </select></label>

        <label className="hyper-deck-send"><input type="checkbox" checked={sending} disabled={busy || !file || !sink || !canSend()} onChange={e => void transmit(e.target.checked)} /> {hyperTranslate("Transmit to voice channel")}{busy && hyperTranslate("· connecting…")}</label>

        <p role="status">{status}</p>

        <details><summary>{hyperTranslate("Initial setup and voice settings")}</summary>

            <p>{hyperTranslate("A virtual device such as VB-CABLE is required. Select CABLE Input here and CABLE Output under Discord → Voice & Video → Input Device. Keep your physical headphones as Discord's output.")}</p>

            <p>{hyperTranslate("An empty list may mean the virtual device is missing or device permission is unavailable. Restart Discord after installation. Noise suppression can cut out music; disable it while transmitting. Hold your key if using push-to-talk.")}</p>

            <p>{hyperTranslate("Music continues when the menu closes. Leaving voice stops playback. Changing channels or muting disables transmission. The checkbox only indicates local routing, not that others can hear you.")}</p>

        </details>

    </fieldset>;

    return <span className="hyper-deck-connection" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>

        <button ref={trigger} type="button" className="hyper-deck-panel-button" aria-label={hyperTranslate("Open HYPER Deck menu")} aria-haspopup="dialog" aria-expanded={expanded} onClick={() => setExpanded(true)}>

            <span className="hyper-deck-panel-display">

                {visualizer && file

                    ? <canvas ref={smallCanvas} width={320} height={28} role="img" aria-label={`${playing ? hyperTranslate("Playing") : hyperTranslate("Paused")}: ${file}`} />

                    : <span>{original}</span>}

            </span>

            <svg aria-hidden="true" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 9v6m4-10v14m4-16v18m4-14v10m4-7v4" /></svg>

        </button>

        {expanded && ReactDOM.createPortal(<div className="hyper-deck-overlay" onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) close(); }}>

            <div ref={dialog} tabIndex={-1} className="hyper-deck-dialog" role="dialog" aria-modal="true" aria-labelledby="hyper-deck-dialog-title" onKeyDown={e => {

                e.stopPropagation();

                if (e.key === "Escape") { e.preventDefault(); close(); }

                if (e.key === "Tab") {

                    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), summary")).filter(el => el.getClientRects().length);

                    const first = items[0];

                    const last = items[items.length - 1];

                    if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last?.focus(); }

                    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === e.currentTarget)) { e.preventDefault(); first?.focus(); }

                }

            }}>{menu}</div>

        </div>, document.body)}

    </span>;

}



const VoicePanel = ErrorBoundary.wrap(Player, { noop: true });



function ConnectedPanel({ original }: { original: React.ReactNode; }) {

    const connected = useStateFromStores([SelectedChannelStore], () => !!channel());

    return connected ? <VoicePanel original={original} /> : original;

}



export default definePlugin({

    name: "HyperDeck",

    description: hyperTranslate("MP3 player, live visualizer and music transmission through a virtual audio device."),

    authors: [{ name: "HYPER DC", id: 0n }],

    enabledByDefault: true,

    patches: [{

        find: "hasConnectedChannel:null!=",

        replacement: {

            match: /(children:)(\(0,\i\.jsx\)\(\i,\{text:\i,textVariant:\i,hasVideo:\i,className:\i\[\i\],hasConnectedChannel:null!=\i\}\))/,

            replace: "$1$self.renderVoicePanel($2)"

        }

    }],

    renderVoicePanel(original: React.ReactNode) {

        return <ConnectedPanel original={original} />;

    },

    settingsAboutComponent: () => <p>{hyperTranslate("Join a voice channel and click the wave button in the bottom-left voice panel. Toggle the visualizer in the menu. Music continues when the menu closes.")}</p>,

    stop() { sessions.forEach(stop => stop()); }

});

