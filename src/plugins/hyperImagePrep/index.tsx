/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@utils/hyperTools/style.css";
import "./style.css";

import { ChatBarButton } from "@api/ChatButtons";
import definePlugin from "@utils/types";
import { ChannelStore, closeModal, DraftType, Modal, openModal, React, SelectedChannelStore, UploadHandler, UserStore } from "@webpack/common";

import { rectangle } from "./rect";
import { VideoPrep } from "./video";

function Icon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 2v16h16M2 6h16v16M9 9h6v6H9z" /></svg>; }
function Editor({ channelId, close }: { channelId?: string; close: () => void; }) {
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const image = React.useRef<HTMLCanvasElement | undefined>(undefined);
    const original = React.useRef<HTMLCanvasElement | undefined>(undefined);
    const undo = React.useRef<HTMLCanvasElement[]>([]);
    const generation = React.useRef(0);
    const owner = React.useRef(UserStore.getCurrentUser()?.id);
    const start = React.useRef<{ x: number; y: number; } | undefined>(undefined);
    const drawingBase = React.useRef<HTMLCanvasElement | undefined>(undefined);
    const last = React.useRef<{ x: number; y: number; } | undefined>(undefined);
    const [tool, setTool] = React.useState("select");
    const [color, setColor] = React.useState("#ff713e");
    const [thickness, setThickness] = React.useState(6);
    const [selection, setSelection] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [revision, setRevision] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState("PNG, JPEG veya WebP seç. Düzenleme cihazında yapılır; asıl dosyan değişmez.");
    const [result, setResult] = React.useState<{ file: File; url: string; }>();
    React.useEffect(() => () => { generation.current++; image.current = undefined; original.current = undefined; undo.current = []; }, []);
    React.useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
    function copy(source: HTMLCanvasElement) {
        const next = document.createElement("canvas"); next.width = source.width; next.height = source.height;
        next.getContext("2d")!.drawImage(source, 0, 0); return next;
    }
    function changed() {
        const current = image.current!;
        setDimensions({ width: current.width, height: current.height }); setSelection({ x: 0, y: 0, width: 0, height: 0 });
        setResult(undefined); setRevision(value => value + 1);
    }
    React.useEffect(() => {
        if (!canvas.current || !image.current) return;
        const target = canvas.current; target.width = image.current.width; target.height = image.current.height;
        const ctx = target.getContext("2d")!; ctx.drawImage(image.current, 0, 0);
        const rect = rectangle(selection, target.width, target.height);
        if (rect.width && rect.height) {
            ctx.strokeStyle = "#ff713e"; ctx.lineWidth = Math.max(2, target.width / 400); ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
    }, [revision, selection]);
    async function load(file?: File) {
        if (!file) return;
        const token = ++generation.current; setBusy(true); setResult(undefined);
        try {
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) throw Error("En fazla 20 MB PNG, JPEG veya WebP seç.");
            const bitmap = await createImageBitmap(file);
            try {
                if (token !== generation.current) return;
                if (bitmap.width * bitmap.height > 8_000_000 || bitmap.width > 8192 || bitmap.height > 8192) throw Error("Görsel çok büyük. En fazla 8 milyon piksel destekleniyor.");
                const next = document.createElement("canvas"); next.width = bitmap.width; next.height = bitmap.height;
                next.getContext("2d")!.drawImage(bitmap, 0, 0);
                image.current = next; original.current = copy(next); undo.current = []; changed();
                setStatus("Alan seçmek için görsel üzerinde sürükle veya aşağıdaki ölçüleri gir. Hareketli WebP’nin yalnızca ilk karesi kullanılır.");
            } finally { bitmap.close(); }
        } catch (error) { if (token === generation.current) setStatus(error instanceof Error ? error.message : "Görsel açılamadı."); }
        finally { if (token === generation.current) setBusy(false); }
    }
    function apply(action: "crop" | "cover" | "blur") {
        if (!image.current || busy) return;
        const source = image.current; const rect = rectangle(selection, source.width, source.height);
        if (!rect.width || !rect.height) return;
        undo.current.push(copy(source)); if (undo.current.length > 3) undo.current.shift();
        if (action === "crop") {
            const cropped = document.createElement("canvas"); cropped.width = rect.width; cropped.height = rect.height;
            cropped.getContext("2d")!.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height); image.current = cropped;
        } else {
            const ctx = source.getContext("2d")!;
            ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.width, rect.height); ctx.clip();
            if (action === "cover") { ctx.fillStyle = "#111111"; ctx.fillRect(rect.x, rect.y, rect.width, rect.height); }
            else { ctx.filter = "blur(18px)"; ctx.drawImage(undo.current.at(-1)!, 0, 0); }
            ctx.restore();
        }
        changed(); setStatus(action === "cover" ? "Seçili alan kalıcı olarak kapatıldı. PNG hazırlayıp son hâlini kontrol et." : "Düzenleme uygulandı.");
    }
    async function prepare() {
        if (!image.current) return;
        setBusy(true); const token = generation.current;
        try {
            const blob = await new Promise<Blob>((resolve, reject) => image.current!.toBlob(value => value ? resolve(value) : reject(Error("PNG oluşturulamadı.")), "image/png"));
            if (token !== generation.current) return;
            const file = new File([blob], "hazir-gorsel.png", { type: "image/png" });
            setResult({ file, url: URL.createObjectURL(file) }); setStatus("PNG hazır. Orijinal EXIF/GPS ve dosya adı aktarılmadı. Görselde yazan kişisel bilgileri ayrıca kontrol et.");
        } catch { if (token === generation.current) setStatus("PNG hazırlanamadı."); }
        finally { if (token === generation.current) setBusy(false); }
    }
    function point(event: React.PointerEvent<HTMLCanvasElement>) {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { x: Math.max(0, Math.min(dimensions.width, (event.clientX - bounds.left) * dimensions.width / bounds.width)), y: Math.max(0, Math.min(dimensions.height, (event.clientY - bounds.top) * dimensions.height / bounds.height)) };
    }
    function draw(end: { x: number; y: number; }) {
        if (!image.current || !start.current || !drawingBase.current) return;
        const ctx = image.current.getContext("2d")!;
        if (tool !== "pen") { ctx.clearRect(0, 0, image.current.width, image.current.height); ctx.drawImage(drawingBase.current, 0, 0); }
        const from = tool === "pen" ? last.current! : start.current;
        ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = thickness; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        if (tool === "pen" && from.x === end.x && from.y === end.y) { ctx.beginPath(); ctx.arc(end.x, end.y, thickness / 2, 0, Math.PI * 2); ctx.fill(); }
        if (tool === "arrow") {
            const angle = Math.atan2(end.y - from.y, end.x - from.x); const size = Math.max(14, thickness * 3);
            ctx.beginPath(); ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6)); ctx.closePath(); ctx.fill();
        }
        ctx.restore(); last.current = end; setRevision(value => value + 1); setResult(undefined);
    }
    function finishDrawing(cancel = false) {
        if (drawingBase.current) {
            if (cancel) image.current = drawingBase.current;
            else { undo.current.push(drawingBase.current); if (undo.current.length > 3) undo.current.shift(); }
            drawingBase.current = undefined; changed();
        }
        start.current = undefined; last.current = undefined;
    }
    const valid = rectangle(selection, dimensions.width, dimensions.height);
    return <div className="hyper-tools hyper-image-prep">
        <VideoPrep channelId={channelId} close={close} />
        <h3>Görsel düzenle</h3>
        <p role="status">{status}</p>
        <label>Görsel seç <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void load(file); }} /></label>
        {dimensions.width > 0 && <>
            <div className="hyper-tools-actions"><label>Araç <select value={tool} disabled={busy} onChange={event => setTool(event.target.value)}><option value="select">Alan seç</option><option value="pen">Serbest çizim</option><option value="line">Düz çizgi</option><option value="arrow">Ok</option></select></label><label>Renk <input type="color" value={color} disabled={busy} onChange={event => setColor(event.target.value)} /></label><label>Kalınlık · {thickness} px <input type="range" min="1" max="60" value={thickness} disabled={busy} onChange={event => setThickness(Number(event.target.value))} /></label></div>
            <canvas ref={canvas} aria-label="Seçtiğin araçla sürükleyerek düzenle." onPointerDown={event => { if (busy || start.current || event.button !== 0) return; start.current = point(event); last.current = start.current; event.currentTarget.setPointerCapture(event.pointerId); setSelection({ ...start.current, width: 0, height: 0 }); if (tool !== "select") drawingBase.current = copy(image.current!); }} onPointerMove={event => { if (!start.current || busy) return; const end = point(event); if (tool !== "select") { draw(end); return; } setSelection({ x: Math.min(start.current.x, end.x), y: Math.min(start.current.y, end.y), width: Math.abs(end.x - start.current.x), height: Math.abs(end.y - start.current.y) }); }} onPointerUp={event => { if (tool !== "select") draw(point(event)); finishDrawing(); }} onPointerCancel={() => finishDrawing(true)} onLostPointerCapture={() => { if (start.current) finishDrawing(true); }} />
            <small>{dimensions.width} × {dimensions.height} piksel · Geri alma: son 3 işlem</small>
            <div className="hyper-tools-actions">{(["x", "y", "width", "height"] as const).map((key, i) => <label key={key}>{["Sol", "Üst", "Genişlik", "Yükseklik"][i]}<input type="number" min="0" max={key === "x" || key === "width" ? dimensions.width : dimensions.height} value={Math.round(selection[key])} disabled={busy} onChange={event => setSelection(value => ({ ...value, [key]: Number(event.target.value) }))} /></label>)}</div>
            <div className="hyper-tools-actions"><button disabled={busy || !valid.width || !valid.height} onClick={() => apply("crop")}>Seçilene kırp</button><button disabled={busy || !valid.width || !valid.height} onClick={() => apply("cover")}>Alanı kapat</button><button disabled={busy || !valid.width || !valid.height} onClick={() => apply("blur")}>Bulanıklaştır</button><button disabled={busy || !undo.current.length} onClick={() => { image.current = undo.current.pop(); changed(); }}>Geri al</button><button disabled={busy} onClick={() => { image.current = copy(original.current!); undo.current = []; changed(); }}>Baştan başla</button></div>
            <small>Parola, adres veya token gizlerken “Alanı kapat” kullan. Bulanıklaştırma kesin gizleme sağlamaz.</small>
            <div className="hyper-tools-actions"><button disabled={busy} onClick={() => void prepare()}>PNG hazırla</button></div>
        </>}
        {result && <section aria-label="Hazırlanan dosya"><img src={result.url} alt="Göndermeden önce hazırlanmış PNG’nin son hâli" /><p>hazir-gorsel.png · {(result.file.size / 1024 / 1024).toFixed(2)} MB</p><div className="hyper-tools-actions"><a href={result.url} download="hazir-gorsel.png">PNG’yi indir</a><button disabled={busy || !channelId} onClick={() => {
            const channel = channelId && ChannelStore.getChannel(channelId);
            if (!channel || SelectedChannelStore.getChannelId() !== channelId || UserStore.getCurrentUser()?.id !== owner.current) { setStatus("Kanal veya hesap değişti. Bu pencereyi kapatıp hedef kanalda yeniden aç."); return; }
            try { UploadHandler.promptToUpload([result.file], channel, DraftType.ChannelMessage); close(); }
            catch { setStatus("Discord ek penceresi açılamadı. PNG’yi indirip elle ekleyebilirsin."); }
        }}>Discord ek penceresini aç</button></div><small>Bu düğme dosyayı Discord’a yüklemeye başlayabilir. Mesajı göndermek için Discord’da ayrıca onay verirsin.</small></section>}
    </div>;
}
function openEditor(channelId = SelectedChannelStore.getChannelId()) { openModal(props => <Modal {...props} title="HyperImagePrep · Dosya hazırla"><Editor channelId={channelId} close={props.onClose} /></Modal>, { modalKey: "hyper-image-prep" }); }
export default definePlugin({
    name: "HyperImagePrep",
    description: "Görselleri kırp, üzerine çiz, ok ekle veya alanları kapat. Videolardan süre seçerek WebM kesit hazırla.",
    authors: [{ name: "HyperDC", id: 0n }],
    enabledByDefault: true,
    tags: ["Media", "Privacy"],
    chatBarButton: { icon: Icon, render: ({ channel, isAnyChat }) => isAnyChat ? <ChatBarButton tooltip="Dosya hazırla" onClick={() => openEditor(channel.id)}><Icon /></ChatBarButton> : null },
    settingsAboutComponent: () => <div className="hyper-tools"><button onClick={() => openEditor()}>Görsel hazırlama penceresini aç</button></div>,
    toolboxActions: { "Görsel hazırla": () => openEditor() },
    stop() { closeModal("hyper-image-prep"); }
});
