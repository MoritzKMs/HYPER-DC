/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, DraftType, React, SelectedChannelStore, UploadHandler, UserStore } from "@webpack/common";

import { validTrim } from "./trim";

export function VideoPrep({ channelId, close }: { channelId?: string; close: () => void; }) {
    const video = React.useRef<HTMLVideoElement>(null);
    const cancel = React.useRef<(() => void) | undefined>(undefined);
    const mounted = React.useRef(true);
    const owner = React.useRef(UserStore.getCurrentUser()?.id);
    const [source, setSource] = React.useState("");
    const [duration, setDuration] = React.useState(0);
    const [from, setFrom] = React.useState(0);
    const [to, setTo] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState("");
    const [result, setResult] = React.useState<{ file: File; url: string; }>();
    React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancel.current?.(); }; }, []);
    React.useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
    React.useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

    async function prepare() {
        const media = video.current as (HTMLVideoElement & { captureStream?: () => MediaStream; }) | null;
        if (!media || busy) return;
        if (!validTrim(from, to, duration)) {
            setStatus("Geçerli bir başlangıç ve bitiş seç. Kesit 0,25 saniye ile 5 dakika arasında olmalı."); return;
        }
        if (!media.captureStream || typeof MediaRecorder === "undefined") { setStatus("Bu Discord sürümü yerel video kesmeyi desteklemiyor."); return; }
        const mimeType = ["video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) { setStatus("WebM kodlayıcısı bulunamadı."); return; }
        setBusy(true); setResult(undefined); setStatus("Kesit hazırlanıyor. İşlem bitene kadar bu pencereyi açık tut.");
        let aborted = false;
        let recorder: MediaRecorder | undefined;
        let stream: MediaStream | undefined;
        let timer: ReturnType<typeof setInterval> | undefined;
        let rejectPending: ((error: Error) => void) | undefined;
        const oldMuted = media.muted;
        const cleanup = () => {
            if (timer) clearInterval(timer);
            if (recorder && recorder.state !== "inactive") recorder.stop();
            stream?.getTracks().forEach(track => track.stop());
            media.pause(); media.muted = oldMuted;
        };
        cancel.current = () => { aborted = true; rejectPending?.(Error("İşlem iptal edildi.")); cleanup(); };
        try {
            media.pause(); media.muted = true; media.playbackRate = 1;
            if (Math.abs(media.currentTime - from) > 0.001) {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => done(Error("Video konumuna geçilemedi.")), 10000);
                    const done = (error?: Error) => { clearTimeout(timeout); media.removeEventListener("seeked", seeked); rejectPending = undefined; error ? reject(error) : resolve(); };
                    const seeked = () => done();
                    rejectPending = error => done(error);
                    media.addEventListener("seeked", seeked, { once: true }); media.currentTime = from;
                });
            }
            if (aborted) return;
            stream = media.captureStream();
            if (!stream.getVideoTracks().length) throw Error("Bu videonun görüntü akışı alınamadı. Başka bir MP4 veya WebM dene.");
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
            const chunks: Blob[] = [];
            let size = 0;
            const output = new Promise<Blob>((resolve, reject) => {
                rejectPending = reject;
                recorder!.ondataavailable = event => {
                    size += event.data.size;
                    if (size > 100 * 1024 * 1024) { reject(Error("Çıktı 100 MB sınırını aştı. Daha kısa bir kesit seç.")); cleanup(); return; }
                    if (event.data.size) chunks.push(event.data);
                };
                recorder!.onerror = () => reject(Error("Video kodlanamadı."));
                recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
            });
            // Handle play failure without leaving a rejected recording promise unobserved.
            void output.catch(() => {});
            recorder.start(250);
            const started = Date.now();
            timer = setInterval(() => {
                if (media.currentTime >= to || media.ended) { if (recorder?.state === "recording") recorder.stop(); media.pause(); }
                else if (Date.now() - started > (to - from + 20) * 1000) { rejectPending?.(Error("Video ilerlemedi. Kesit hazırlanamadı.")); cleanup(); }
                if (!aborted) setStatus(`Hazırlanıyor · ${Math.min(100, Math.round((media.currentTime - from) / (to - from) * 100))}%`);
            }, 40);
            await media.play();
            const blob = await output;
            if (aborted) return;
            if (!blob.size) throw Error("Video çıktısı boş.");
            const file = new File([blob], "hazir-video.webm", { type: "video/webm" });
            setResult({ file, url: URL.createObjectURL(file) }); setStatus("Kesit hazır. Göndermeden önce görüntüyü ve sesi ön izlemede kontrol et.");
        } catch (error) { if (!aborted) setStatus(error instanceof Error ? error.message : "Video hazırlanamadı."); }
        finally { cleanup(); cancel.current = undefined; if (mounted.current) setBusy(false); }
    }

    return <section>
        <h3>Video kes</h3>
        <p>MP4 veya WebM · En fazla 100 MB, 1920 × 1080 piksel. Başlangıç ve bitiş arasını WebM olarak hazırlar; görüntünün kenarlarını kırpmaz. İşlem kesit süresi kadar sürer ve yeniden kodlama kaliteyi değiştirebilir.</p>
        <input aria-label="Video seç" type="file" accept="video/mp4,video/webm" disabled={busy} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file) return;
            if (!["video/mp4", "video/webm"].includes(file.type) || file.size > 100 * 1024 * 1024) { setStatus("En fazla 100 MB MP4 veya WebM seç."); return; }
            setResult(undefined); setDuration(0); setFrom(0); setTo(0); setStatus(""); setSource(URL.createObjectURL(file));
        }} />
        {source && <>
            <video ref={video} src={source} controls={!busy} preload="metadata" onLoadedMetadata={event => {
                const media = event.currentTarget;
                if (!Number.isFinite(media.duration) || media.duration <= 0 || media.videoWidth * media.videoHeight > 1920 * 1080) { setDuration(0); setStatus("Video süresi okunamadı veya çözünürlüğü 1080p sınırını aşıyor."); return; }
                setDuration(media.duration); setTo(Math.min(media.duration, 300));
            }} onError={() => { setDuration(0); setStatus("Video açılamadı. Desteklenen bir MP4 veya WebM seç."); }} />
            <div className="hyper-tools-actions"><label>Başlangıç (s)<input type="number" min="0" max={duration} step="0.1" disabled={busy} value={from} onChange={event => { setFrom(Number(event.target.value)); setResult(undefined); }} /></label><label>Bitiş (s)<input type="number" min="0" max={duration} step="0.1" disabled={busy} value={to} onChange={event => { setTo(Number(event.target.value)); setResult(undefined); }} /></label><button disabled={busy || !duration} onClick={() => void prepare()}>Kesiti hazırla</button>{busy && <button onClick={() => { cancel.current?.(); setStatus("İşlem iptal edildi."); }}>İptal</button>}</div>
        </>}
        <p role="status">{status}</p>
        {result && <><video src={result.url} controls /><p>{result.file.name} · {(result.file.size / 1024 / 1024).toFixed(2)} MB</p><div className="hyper-tools-actions"><a href={result.url} download={result.file.name}>Videoyu indir</a><button onClick={() => {
            const channel = channelId && ChannelStore.getChannel(channelId);
            if (!channel || SelectedChannelStore.getChannelId() !== channelId || UserStore.getCurrentUser()?.id !== owner.current) { setStatus("Kanal veya hesap değişti. Hedef kanalda yeniden aç."); return; }
            try { UploadHandler.promptToUpload([result.file], channel, DraftType.ChannelMessage); close(); }
            catch { setStatus("Ek penceresi açılamadı. Videoyu indirip elle ekleyebilirsin."); }
        }}>Discord ek penceresini aç</button></div><small>Dosya Discord’a yüklenmeye başlayabilir. Mesajı ayrıca gönderirsin.</small></>}
    </section>;
}
