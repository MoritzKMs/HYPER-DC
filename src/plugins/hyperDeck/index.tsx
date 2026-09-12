/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import definePlugin, { IconComponent } from "@utils/types";
import { MediaEngineStore, Modal, openModal, React, SelectedChannelStore, useStateFromStores } from "@webpack/common";

import { DeckAudio, isVirtualDevice } from "./audio";

const sessions = new Set<() => void>();
const channel = () => SelectedChannelStore.getVoiceChannelId();
const canSend = () => !!channel() && !MediaEngineStore.isSelfMute() && !MediaEngineStore.isSelfDeaf();
const time = (s: number) => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";

function Player() {
    const engine = React.useRef<DeckAudio | undefined>(undefined);
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const [file, setFile] = React.useState("");
    const [status, setStatus] = React.useState("MP3 seçerek başla. Dosya sunucuya yüklenmez.");
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [sink, setSink] = React.useState("");
    const [mic, setMic] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
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
        const refresh = () => navigator.mediaDevices.enumerateDevices().then(d => { if (alive) setDevices(d); }).catch(() => { if (alive) setStatus("Ses aygıtları okunamadı."); });
        const stop = () => { deck.disableSend(); deck.audio.pause(); if (alive) setSending(false); };
        const ended = () => { stop(); setPlaying(false); };
        const error = () => { ended(); setStatus("MP3 çözümlenemedi. Başka bir dosya seç."); };
        const update = () => { setPosition(deck.audio.currentTime); setDuration(deck.audio.duration || 0); setPlaying(!deck.audio.paused); };
        deck.audio.addEventListener("ended", ended);
        deck.audio.addEventListener("error", error);
        deck.audio.addEventListener("timeupdate", update);
        deck.audio.addEventListener("loadedmetadata", update);
        const changed = () => { stop(); setStatus("Ses aygıtı değişti; aktarımı yeniden aç."); void refresh(); };
        navigator.mediaDevices.addEventListener("devicechange", changed);
        const shutdown = () => { stop(); deck.dispose(); engine.current = undefined; setDisabled(true); };
        sessions.add(shutdown);
        void refresh();
        let frame = 0;
        const bins = new Uint8Array(deck.analyser.frequencyBinCount);
        const draw = () => {
            const ctx = canvas.current?.getContext("2d");
            if (ctx) {
                deck.analyser.getByteFrequencyData(bins);
                ctx.clearRect(0, 0, 640, 140);
                for (let i = 0; i < 64; i++) {
                    const h = Math.max(3, bins[i * 2] / 255 * 126);
                    ctx.fillStyle = `hsl(${22 + i / 3} 95% 60%)`;
                    ctx.fillRect(i * 10 + 1, 136 - h, 6, h);
                }
            }
            frame = requestAnimationFrame(draw);
        };
        draw();
        return () => {
            alive = false;
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
        setSending(false);
    }, [voice]);

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
            setStatus(ok ? "Sanal aygıta aktarım açık. Discord girişini eşleşen sanal mikrofon olarak seç; karşı taraftan duyulduğunu kontrol et." : "Aktarım iptal edildi.");
        } catch (e) {
            deck.disableSend();
            if (engine.current === deck) { setSending(false); setStatus(e instanceof Error ? e.message : "Aktarım başlatılamadı."); }
        } finally { if (engine.current === deck) setBusy(false); }
    }

    return <fieldset className="hyper-deck" disabled={disabled}>
        {disabled && <p>Eklenti kapatıldı. Paneli kapatıp eklentiyi yeniden etkinleştir.</p>}
        <p className="hyper-deck-kicker">HYPER DECK / YEREL MÜZİK</p>
        <label className="hyper-deck-file">MP3 seç
            <input type="file" accept=".mp3,audio/mpeg" disabled={busy} onChange={e => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                if (!chosen) return;
                try { engine.current?.load(chosen); setFile(chosen.name); setSending(false); setPlaying(false); setPosition(0); setDuration(0); setStatus("Hazır. Oynat düğmesine bas."); }
                catch (error) { setStatus((error as Error).message); }
            }} />
        </label>
        <strong className="hyper-deck-title">{file || "Henüz bir parça seçilmedi"}</strong>
        <canvas ref={canvas} width={640} height={140} role="img" aria-label="Müziğin frekans görselleştiricisi" />
        <div className="hyper-deck-row">
            <button disabled={!file} onClick={async () => {
                const deck = engine.current;
                if (!deck) return;
                if (!deck.audio.paused) { deck.audio.pause(); setPlaying(false); return; }
                try { await deck.context.resume(); await deck.audio.play(); if (engine.current === deck) setPlaying(true); }
                catch { setStatus("Oynatma başlatılamadı. Dosyayı ve ses aygıtını kontrol et."); }
            }}>{playing ? "Duraklat" : "Oynat"}</button>
            <button onClick={() => { const d = engine.current; if (d) { d.disableSend(); d.audio.pause(); d.audio.currentTime = 0; } setSending(false); setPlaying(false); }}>Durdur</button>
            <span>{time(position)} / {time(duration)}</span>
        </div>
        <input aria-label="Parça konumu" type="range" min={0} max={Number.isFinite(duration) ? duration : 0} step={0.1} value={position} onChange={e => { if (engine.current) engine.current.audio.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }} />
        <label>Müzik sesi · %{volume}<input type="range" min={0} max={100} value={volume} onChange={e => { const v = Number(e.target.value); setVolume(v); if (engine.current) engine.current.audio.volume = v / 100; }} /></label>
        <div className="hyper-deck-row">
            <label><input type="checkbox" checked={monitor} onChange={e => { setMonitor(e.target.checked); if (engine.current) engine.current.monitor.gain.value = e.target.checked ? 1 : 0; }} /> Bende de çal</label>
            <label><input type="checkbox" onChange={e => { if (engine.current) engine.current.audio.loop = e.target.checked; }} /> Tekrarla</label>
        </div>
        <label>Sanal ses çıkışı<select value={sink} disabled={sending || busy} onChange={e => setSink(e.target.value)}>
            <option value="">Aygıt seç</option>
            {devices.filter(d => d.kind === "audiooutput" && d.deviceId !== "default" && isVirtualDevice(d.label)).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select></label>
        <label>Konuşmamı da karıştır<select value={mic} disabled={sending || busy} onChange={e => setMic(e.target.value)}>
            <option value="">Kapalı · yalnızca müzik</option>
            {devices.filter(d => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications" && !isVirtualDevice(d.label) && d.label).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select></label>
        <label className="hyper-deck-send"><input type="checkbox" checked={sending} disabled={busy || !file || !sink || !canSend()} onChange={e => void transmit(e.target.checked)} /> Ses kanalına aktar {busy && "· bağlanıyor…"}</label>
        <p role="status">{status}</p>
        <details><summary>İlk kurulum ve ses ayarları</summary>
            <p>VB-CABLE gibi bir sanal aygıt gerekir. Burada CABLE Input, Discord → Ses ve Görüntü → Giriş Aygıtı alanında CABLE Output seç. Fiziksel kulaklığını Discord çıkışı olarak bırak.</p>
            <p>Liste boşsa sanal aygıt kurulu olmayabilir veya aygıt izni eksik olabilir. Kurulumdan sonra Discord’u yeniden başlat. Gürültü bastırma müziği kesebilir; müzik aktarırken bunu kapatman gerekebilir. Bas-konuş kullanıyorsan tuşa basılı tut.</p>
            <p>Panel kapanınca, kanal değişince veya mikrofon susturulunca aktarım kapanır. Tik yalnızca yerel yönlendirmeyi gösterir; diğer kişinin sesi aldığı doğrulanmaz.</p>
        </details>
    </fieldset>;
}

const Icon: IconComponent = props => <svg {...props} viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 9v6m4-10v14m4-16v18m4-14v10m4-7v4" /></svg>;
const DeckButton: ChatBarButtonFactory = () => {
    const connected = useStateFromStores([SelectedChannelStore], () => !!channel());
    return connected ? <ChatBarButton tooltip="HYPER Deck · MP3 çalar" onClick={() => openModal(props => <Modal {...props} title="HYPER Deck"><Player /></Modal>)}><Icon /></ChatBarButton> : null;
};

export default definePlugin({
    name: "HyperDeck",
    description: "MP3 çalar, canlı görselleştirici ve sanal ses aygıtıyla ses kanalına müzik aktarımı.",
    authors: [{ name: "HYPER DC", id: 0n }],
    enabledByDefault: true,
    chatBarButton: { icon: Icon, render: DeckButton },
    settingsAboutComponent: Player,
    stop() { sessions.forEach(stop => stop()); }
});
