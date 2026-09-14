/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { claimHyperMicrophone, releaseHyperMicrophone } from "@utils/hyperMicrophone";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, MediaEngineStore, React, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

import { alarmReady, clipping } from "./core";

const actions = findByPropsLazy("toggleSelfMute", "toggleSelfDeaf");
const lease = {};
let context: AudioContext | undefined;
let stream: MediaStream | undefined;
let sampleTimer: ReturnType<typeof setInterval> | undefined;
let generation = 0;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => { revision++; listeners.forEach(fn => fn()); };
export const subscribeAudio = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const audioRevision = () => revision;
export let peakWarning = false;
let message = "";
let guardDevice = "";
let guardName = "";
let account = "";
let alarm: { channelId: string; target: string; previous: string[]; } | undefined;
let pending = false;
function notify(body: string) { void showNotification({ title: "HyperDC", body }); }
export function stopMeter() {
    generation++; if (sampleTimer) clearInterval(sampleTimer); sampleTimer = undefined;
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    if (context) void context.close(); context = undefined; releaseHyperMicrophone(lease); peakWarning = false; emit();
}
export function stopGuard() { guardDevice = ""; guardName = ""; emit(); }
export function stopAlarm() { alarm = undefined; emit(); }
export function audioChanged() {
    if (account && account !== UserStore.getCurrentUser()?.id) { stopAudio(); return; }
    if (context && !SelectedChannelStore.getVoiceChannelId()) stopMeter();
    if (!alarm) return;
    const channel = ChannelStore.getChannel(alarm.channelId);
    if (!channel) { stopAlarm(); return; }
    const current = Object.keys(VoiceStateStore.getVoiceStatesForChannel(alarm.channelId));
    if (alarmReady(alarm.previous, current, alarm.target, channel.userLimit || 0)) {
        notify(alarm.target ? `${UserStore.getUser(alarm.target)?.username || "Seçtiğin kişi"}, ${channel.name} kanalına katıldı.` : `${channel.name} kanalında yer açıldı.`); stopAlarm();
    } else alarm.previous = current;
}
export async function deviceChanged() {
    const watched = guardDevice;
    if (!watched) return;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (guardDevice !== watched || devices.some(d => d.deviceId === watched && d.kind === "audiooutput")) return;
        if (SelectedChannelStore.getVoiceChannelId()) {
            if (!MediaEngineStore.isSelfDeaf()) actions.toggleSelfDeaf();
            if (!MediaEngineStore.isSelfMute()) actions.toggleSelfMute();
        }
        stopMeter(); stopGuard(); notify("Kulaklık bağlantısı kesildi. Discord sesi ve mikrofonu kapatıldı. Yeniden açmayı sen kontrol edersin.");
    } catch { message = "Kulaklık koruması uygulanamadı. Discord sesini elle kapat."; notify(message); emit(); }
}
export function stopAudio() { stopMeter(); stopGuard(); stopAlarm(); account = ""; }
export function AudioTools({ meter, guard, wait, initialChannel }: { meter: boolean; guard: boolean; wait: boolean; initialChannel?: string; }) {
    React.useSyncExternalStore(subscribeAudio, audioRevision);
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [mic, setMic] = React.useState("");
    const [output, setOutput] = React.useState("");
    const [channelId, setChannelId] = React.useState(initialChannel || SelectedChannelStore.getVoiceChannelId() || "");
    const [target, setTarget] = React.useState("");
    async function refresh() { try { setDevices(await navigator.mediaDevices.enumerateDevices()); } catch { message = "Aygıt listesi alınamadı."; emit(); } }
    React.useEffect(() => { void refresh(); }, []);
    async function startMeter() {
        if (pending || context || !mic) return;
        if (!SelectedChannelStore.getVoiceChannelId()) { message = "Önce ses kanalına katıl."; emit(); return; }
        const token = ++generation; pending = true; emit();
        try {
            claimHyperMicrophone(lease); account = UserStore.getCurrentUser()?.id || "";
            const captured = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: mic }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
            if (token !== generation) { captured.getTracks().forEach(track => track.stop()); return; }
            stream = captured; context = new AudioContext(); await context.resume();
            if (token !== generation || !context) return;
            const analyser = context.createAnalyser(); analyser.fftSize = 2048; context.createMediaStreamSource(captured).connect(analyser);
            const data = new Float32Array(analyser.fftSize); let lastWarning = 0; let hot = 0;
            sampleTimer = setInterval(() => {
                analyser.getFloatTimeDomainData(data); hot = !MediaEngineStore.isSelfMute() && clipping(data) ? hot + 1 : 0;
                const next = hot >= 2; if (peakWarning !== next) { peakWarning = next; emit(); }
                if (next && Date.now() - lastWarning > 15000) { lastWarning = Date.now(); notify("Mikrofon girişin tepe seviyesine ulaşıyor. Mikrofon kazancını azaltmayı dene."); }
            }, 100);
            captured.getTracks().forEach(track => track.addEventListener("ended", stopMeter, { once: true }));
            message = "Mikrofon ölçümü açık. Ses kaydedilmez veya oynatılmaz; Discord’un ses işleme sonrasını ölçmez.";
        } catch (error) { if (token === generation) { stopMeter(); message = error instanceof Error ? error.message : "Mikrofon açılamadı."; } }
        finally { pending = false; emit(); }
    }
    return <div>
        {(meter || guard) && <button onClick={() => void refresh()}>Ses aygıtlarını yenile</button>}
        {meter && <section><h3>Mikrofon taşması uyarısı</h3><select aria-label="Ölçülecek mikrofon" disabled={!!context || pending} value={mic} onChange={e => setMic(e.target.value)}><option value="">Mikrofon seç</option>{devices.filter(d => d.kind === "audioinput" && !["default", "communications"].includes(d.deviceId)).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Mikrofon"}</option>)}</select><button disabled={pending || !!context || !mic} onClick={() => void startMeter()}>Ölçümü aç</button><button onClick={stopMeter}>Ölçümü kapat</button><p className={peakWarning ? "hyper-extra-warning" : ""}>{peakWarning ? "⚠ Mikrofon seviyesi çok yüksek" : context ? "Ölçüm açık" : "Ölçüm kapalı"}</p></section>}
        {guard && <section><h3>Kulaklık bağlantısı koruması</h3><p>Discord’da da aynı kulaklığı çıkış aygıtı olarak seç. Aygıt kaybolunca Discord sağırlaştırılır ve mikrofon susturulur. İşletim sisteminin anlık hoparlör geçişini tamamen engelleyemez.</p><select aria-label="Korunacak kulaklık" value={output} onChange={e => setOutput(e.target.value)}><option value="">Kulaklık seç</option>{devices.filter(d => d.kind === "audiooutput" && !["default", "communications"].includes(d.deviceId)).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Ses çıkışı"}</option>)}</select><button disabled={!output} onClick={() => { if (typeof actions.toggleSelfDeaf !== "function" || typeof actions.toggleSelfMute !== "function") { message = "Discord ses kontrolleri bulunamadı."; emit(); return; } guardDevice = output; guardName = devices.find(d => d.deviceId === output)?.label || "Kulaklık"; account = UserStore.getCurrentUser()?.id || ""; message = "Kulaklık koruması açık."; emit(); }}>Korumayı aç</button><button onClick={stopGuard}>Korumayı kapat</button><p>{guardDevice ? `Korunuyor: ${guardName}` : "Koruma kapalı"}</p></section>}
        {wait && <section><h3>Ses kanalı bekleme alarmı</h3><p>Ses kanalına sağ tıklayarak burayı açabilirsin. Kişi kimliğini boş bırakırsan dolu kanalda yer açılmasını bekler. Alarm bir kez çalar.</p><input aria-label="Ses kanalı kimliği" placeholder="Ses kanalı kimliği" value={channelId} onChange={e => setChannelId(e.target.value.trim())} /><input aria-label="Beklenen kullanıcı kimliği" placeholder="Kullanıcı kimliği (isteğe bağlı)" value={target} onChange={e => setTarget(e.target.value.trim())} /><button onClick={() => {
            const channel = ChannelStore.getChannel(channelId);
            if (!channel?.isGuildVocal() || (target && !/^\d{17,20}$/.test(target))) { message = "Geçerli bir ses kanalı ve kullanıcı kimliği seç."; emit(); return; }
            const previous = Object.keys(VoiceStateStore.getVoiceStatesForChannel(channelId));
            if (target ? previous.includes(target) : !channel.userLimit || previous.length < channel.userLimit) { message = target ? "Bu kişi zaten kanalda." : "Kanal zaten boş yer içeriyor veya kişi sınırı yok."; emit(); return; }
            alarm = { channelId, target, previous }; account = UserStore.getCurrentUser()?.id || ""; message = "Alarm kuruldu."; emit();
        }}>Alarmı kur</button><button onClick={stopAlarm}>Alarmı kaldır</button><p>{alarm ? `Bekleniyor: ${ChannelStore.getChannel(alarm.channelId)?.name}` : "Alarm kapalı"}</p></section>}
        <p role="status">{message}</p>
    </div>;
}
