/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@utils/hyperTools/style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { isVirtualDevice } from "@plugins/hyperDeck/audio";
import { applyVoiceSetup, restoreVoiceSetup } from "@plugins/hyperDeck/voiceSetup";
import { claimHyperMicrophone, releaseHyperMicrophone } from "@utils/hyperMicrophone";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { closeModal, MediaEngineStore, Modal, openModal, React, SelectedChannelStore, UserStore } from "@webpack/common";

import { processorSource } from "./dsp";
import { isMonitorOutput, VoiceMonitor } from "./monitor";

const Button = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");
const backupKey = "HyperVoice:VoiceSetupBackup:v1";
const microphoneOwner = {};
let context: AudioContext | undefined;
let stream: MediaStream | undefined;
let worklet: AudioWorkletNode | undefined;
let destination: MediaStreamAudioDestinationNode | undefined;
let gate: GainNode | undefined;
let output: HTMLAudioElement | undefined;
let generation = 0;
let activeChannel: string | undefined;
let activeUser: string | undefined;
let busy = false;
let stopping = false;
let mode = "normal";
const monitor = new VoiceMonitor();
let monitoring = false;
let monitorSink = "";
let monitorVolume = 0.35;
let monitorPending = false;
async function toggleMonitor(enabled: boolean) {
    if (!enabled) { monitor.stop(); monitoring = false; emit(); return; }
    if (!destination || monitorPending) return;
    const token = generation;
    monitorPending = true; emit();
    try { const started = await monitor.start(destination.stream, monitorSink, monitorVolume); if (token === generation) monitoring = started; }
    catch (error) { if (token === generation) { monitoring = false; status = (error as Error).message; } }
    finally { monitorPending = false; emit(); }
}
function monitorDevicesChanged() { monitor.stop(); monitoring = false; emit(); }
let status = "Fiziksel mikrofonunu ve CABLE Input çıkışını seç.";
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => { revision++; listeners.forEach(fn => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function release() {
    monitor.stop(); monitoring = false;
    releaseHyperMicrophone(microphoneOwner);
    generation++;
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    output?.pause(); if (output) output.srcObject = null; output = undefined;
    worklet?.disconnect(); worklet = undefined;
    destination?.stream.getTracks().forEach(track => track.stop()); destination = undefined;
    if (context) void context.close().catch(() => {});
    context = undefined; gate = undefined; activeChannel = undefined; activeUser = undefined;
    emit();
}
async function stop() {
    if (stopping) return;
    stopping = true;
    release();
    try { await restoreVoiceSetup(backupKey); status = "Efekt kapatıldı. Önceki ses ayarların geri yüklendi."; }
    catch { status = "Efekt kapatıldı; ayarları geri yükleme başarısız. Tekrar geri yükle düğmesine bas."; }
    stopping = false; emit();
}
function checkState() {
    if (!context) return;
    if (activeChannel !== SelectedChannelStore.getVoiceChannelId() || activeUser !== UserStore.getCurrentUser()?.id) { void stop(); return; }
    if (gate) gate.gain.value = MediaEngineStore.isSelfMute() || MediaEngineStore.isSelfDeaf() ? 0 : 1;
}
async function start(mic: string, sink: string) {
    if (busy || stopping) return;
    busy = true; emit();
    release();
    const token = generation;
    const channel = SelectedChannelStore.getVoiceChannelId();
    const owner = UserStore.getCurrentUser()?.id;
    const valid = () => generation === token && channel === SelectedChannelStore.getVoiceChannelId() && owner === UserStore.getCurrentUser()?.id;
    try {
        if (!channel || !owner) throw Error("Önce bir ses kanalına katıl.");
        const devices = await navigator.mediaDevices.enumerateDevices();
        const physical = devices.find(device => device.kind === "audioinput" && device.deviceId === mic);
        const cable = devices.find(device => device.kind === "audiooutput" && device.deviceId === sink);
        if (!physical || ["default", "communications"].includes(mic) || isVirtualDevice(physical.label)) throw Error("Gerçek mikrofonunu seç; sanal mikrofon seçme.");
        if (!cable || !/\bCABLE(?:-[AB])? Input\b/i.test(cable.label)) throw Error("CABLE Input sanal çıkışını seç.");
        claimHyperMicrophone(microphoneOwner);
        const captured = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: mic }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, video: false });
        if (!valid()) { captured.getTracks().forEach(track => track.stop()); releaseHyperMicrophone(microphoneOwner); return; }
        stream = captured; context = new AudioContext(); activeChannel = channel; activeUser = owner;
        const current = context;
        const blob = URL.createObjectURL(new Blob([processorSource], { type: "application/javascript" }));
        try { await current.audioWorklet.addModule(blob); } finally { URL.revokeObjectURL(blob); }
        if (!valid()) return;
        worklet = new AudioWorkletNode(current, "hyper-voice", { outputChannelCount: [1] });
        worklet.port.postMessage(mode);
        const compressor = current.createDynamicsCompressor(); compressor.threshold.value = -10; compressor.ratio.value = 6;
        const filter = current.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 80;
        gate = current.createGain(); gate.gain.value = 0;
        destination = current.createMediaStreamDestination();
        current.createMediaStreamSource(captured).connect(filter).connect(worklet).connect(compressor).connect(gate).connect(destination);
        const audio = new Audio(); output = audio;
        audio.srcObject = destination.stream;
        if (!audio.setSinkId) throw Error("Bu istemci ses çıkışı seçimini desteklemiyor.");
        await audio.setSinkId(sink);
        if (!valid()) return;
        await current.resume(); await audio.play();
        if (!valid()) return;
        await applyVoiceSetup(devices, sink, backupKey);
        if (!valid()) { await restoreVoiceSetup(backupKey); return; }
        checkState(); status = "Efekt açık. Discord mikrofonu CABLE Output olarak ayarlandı. HyperDeck’te ‘Konuşmamı da karıştır’ kapalı kalsın.";
        captured.getTracks().forEach(track => track.addEventListener("ended", () => { if (generation === token) void stop(); }));
    } catch (error) {
        if (generation === token) { release(); try { await restoreVoiceSetup(backupKey); } catch { } status = error instanceof Error ? error.message : "Ses efekti başlatılamadı."; }
    } finally { busy = false; emit(); }
}

function Icon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9v6m4-10v14m4-17v20m4-17v14m4-10v6" /></svg>; }
function Panel() {
    React.useSyncExternalStore(subscribe, () => revision);
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [mic, setMic] = React.useState("");
    const [sink, setSink] = React.useState("");
    async function refresh() {
        try { setDevices(await navigator.mediaDevices.enumerateDevices()); }
        catch { status = "Ses aygıtları okunamadı."; emit(); }
    }
    React.useEffect(() => { void refresh(); }, []);
    return <div className="hyper-tools">
        <p>Mikrofon sesini VB-CABLE üzerinden değiştirir. İnce/Kadınsı seçeneği ses perdesini yükseltir; doğal ses dönüşümü değildir.</p>
        <label>Ses efekti <select value={mode} onChange={event => { mode = event.target.value; worklet?.port.postMessage(mode); emit(); }}>
            <option value="normal">Normal</option><option value="robot">Robot</option><option value="bright">İnce / Kadınsı</option><option value="deep">Kalın</option><option value="chipmunk">Helyum</option><option value="monster">Canavar</option><option value="alien">Uzaylı</option><option value="radio">Telsiz</option><option value="echo">Yankı</option>
        </select></label>
        <p><label>Fiziksel mikrofon <select value={mic} disabled={busy || !!context} onChange={event => setMic(event.target.value)}><option value="">Mikrofon seç</option>{devices.filter(device => device.kind === "audioinput" && !["default", "communications"].includes(device.deviceId) && !isVirtualDevice(device.label)).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || "Mikrofon"}</option>)}</select></label></p>
        <p><label>Sanal çıkış <select value={sink} disabled={busy || !!context} onChange={event => setSink(event.target.value)}><option value="">CABLE Input seç</option>{devices.filter(device => device.kind === "audiooutput" && /\bCABLE(?:-[AB])? Input\b/i.test(device.label)).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label></p>
        <div className="hyper-tools-actions"><button disabled={busy || !!context} onClick={() => void refresh()}>Aygıtları yenile</button><button disabled={busy || !!context || !mic || !sink} onClick={() => void start(mic, sink)}>Efekti aç ve ses ayarlarını uygula</button><button disabled={busy} onClick={() => void stop()}>Kapat ve ayarları geri yükle</button></div>
        <p><label>Dinleme çıkışı <select value={monitorSink} disabled={monitoring || monitorPending} onChange={event => { monitorSink = event.target.value; emit(); }}><option value="">Kulaklık / hoparlör seç</option>{devices.filter(isMonitorOutput).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label></p>
        <p><label><input type="checkbox" checked={monitoring} disabled={!context || busy || monitorPending || !monitorSink} onChange={event => void toggleMonitor(event.target.checked)} /> Kendi sesimi duy</label></p>
        <label>Dinleme sesi · %{Math.round(monitorVolume * 100)} <input type="range" min="0" max="100" value={Math.round(monitorVolume * 100)} onChange={event => { monitorVolume = Number(event.target.value) / 100; monitor.setVolume(monitorVolume); emit(); }} /></label>
        <p><small>Yankı oluşmaması için kulaklık kullan. Dinleme sesi yalnızca senin duyduğun seviyeyi değiştirir. Mikrofon susturulunca kendi sesin de kesilir.</small></p>
        <p role="status">{status}</p><small>Menüyü kapatınca efekt devam eder. Mikrofon susturma düğmen çalışır. Ses kanalından çıkınca efekt durur.</small>
    </div>;
}
function openPanel() { openModal(props => <Modal {...props} title="HyperVoice"><Panel /></Modal>, { modalKey: "hyper-voice" }); }
function VoiceButton(props: { nameplate?: unknown; }) {
    React.useSyncExternalStore(subscribe, () => revision);
    return <Button tooltipText={context ? "HyperVoice · Efekt açık" : "HyperVoice · Ses değiştir"} icon={Icon} plated={props?.nameplate != null} onClick={openPanel} />;
}
export default definePlugin({
    name: "HyperVoice",
    description: "Mikrofon yanında dokuz ses seçeneği ve kendi sesini dinleme. VB-CABLE gerektirir.",
    authors: [{ name: "HyperDC", id: 0n }],
    enabledByDefault: true,
    patches: [{ find: "#{intl::USER_PROFILE_ACCOUNT_POPOUT_BUTTON_A11Y_LABEL}", replacement: { match: /(\(0,\i\.jsx\)\(\i,\{accountContainerRef:)/, replace: "$self.VoiceButton(arguments[0]),$1" } }],
    VoiceButton: ErrorBoundary.wrap(VoiceButton, { noop: true }),
    settingsAboutComponent: Panel,
    toolboxActions: { HyperVoice: openPanel },
    start() { MediaEngineStore.addChangeListener(checkState); SelectedChannelStore.addChangeListener(checkState); UserStore.addChangeListener(checkState); navigator.mediaDevices.addEventListener("devicechange", monitorDevicesChanged); },
    stop() { MediaEngineStore.removeChangeListener(checkState); SelectedChannelStore.removeChangeListener(checkState); UserStore.removeChangeListener(checkState); navigator.mediaDevices.removeEventListener("devicechange", monitorDevicesChanged); closeModal("hyper-voice"); void stop(); }
});
