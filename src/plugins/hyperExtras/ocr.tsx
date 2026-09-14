/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { rectangle } from "@plugins/hyperImagePrep/rect";
import { PluginNative } from "@utils/types";
import { React } from "@webpack/common";

export function OCR({ address }: { address?: string; }) {
    const native = VencordNative.pluginHelpers.HyperExtras as PluginNative<typeof import("./native")>;
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const original = React.useRef<HTMLCanvasElement | undefined>(undefined);
    const start = React.useRef<{ x: number; y: number; } | undefined>(undefined);
    const generation = React.useRef(0);
    const [selection, setSelection] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
    const [text, setText] = React.useState("");
    const [status, setStatus] = React.useState("Görsel seç, okunacak alanı sürükle, ardından yazıyı oku.");
    const [busy, setBusy] = React.useState(false);
    async function load(blob: Blob) {
        const token = ++generation.current; setBusy(true); setText("");
        try {
            if (blob.size > 8 * 1024 * 1024) throw Error("Görsel en fazla 8 MB olabilir.");
            const bitmap = await createImageBitmap(blob);
            try {
                if (token !== generation.current) return;
                if (bitmap.width * bitmap.height > 16_000_000) throw Error("Görsel 16 milyon piksel sınırını aşıyor.");
                const source = document.createElement("canvas"); const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
                source.width = Math.round(bitmap.width * scale); source.height = Math.round(bitmap.height * scale); source.getContext("2d")!.drawImage(bitmap, 0, 0, source.width, source.height); original.current = source;
                setSelection({ x: 0, y: 0, width: source.width, height: source.height }); setStatus("Tüm görsel seçili. İstersen sürükleyerek daha küçük bir alan seç.");
            } finally { bitmap.close(); }
        } catch (error) { if (token === generation.current) setStatus((error as Error).message); }
        finally { if (token === generation.current) setBusy(false); }
    }
    React.useEffect(() => {
        let alive = true;
        if (address) { setBusy(true); void native.readImage(address).then(bytes => { if (alive) return load(new Blob([new Uint8Array(bytes)])); }).catch(() => { if (alive) { setBusy(false); setStatus("Görsel alınamadı. Dosyayı cihazından seçebilirsin."); } }); }
        return () => { alive = false; generation.current++; original.current = undefined; };
    }, []);
    React.useEffect(() => { if (!canvas.current || !original.current) return; const target = canvas.current; target.width = original.current.width; target.height = original.current.height; const ctx = target.getContext("2d")!; ctx.drawImage(original.current, 0, 0); ctx.strokeStyle = "#ff713e"; ctx.lineWidth = 3; ctx.strokeRect(selection.x, selection.y, selection.width, selection.height); }, [selection]);
    function point(event: React.PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * event.currentTarget.width, y: (event.clientY - rect.top) / rect.height * event.currentTarget.height }; }
    return <section className="hyper-extra-ocr"><h3>Görselden yazı al</h3><p>Windows’un yüklü OCR dilleri kullanılır; görsel bir servise gönderilmez. Sonucu kontrol ederek kopyala.</p><input type="file" aria-label="OCR görseli" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void load(file); }} /><canvas ref={canvas} onPointerDown={e => { if (busy || !original.current) return; start.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!start.current || busy || !original.current) return; const end = point(e); setSelection(rectangle({ x: Math.min(start.current.x, end.x), y: Math.min(start.current.y, end.y), width: Math.abs(end.x - start.current.x), height: Math.abs(end.y - start.current.y) }, original.current.width, original.current.height)); }} onPointerUp={() => { start.current = undefined; }} onPointerCancel={() => { start.current = undefined; }} /><button disabled={busy || !selection.width || !selection.height} onClick={async () => {
        if (!original.current) return; const token = generation.current; setBusy(true); setText("");
        try { const crop = document.createElement("canvas"); crop.width = selection.width; crop.height = selection.height; crop.getContext("2d")!.drawImage(original.current, selection.x, selection.y, selection.width, selection.height, 0, 0, crop.width, crop.height); const result = await native.recognize(crop.toDataURL("image/png")); if (token === generation.current) { setText(result); setStatus(result ? "Yazı hazır." : "Seçili alanda yazı bulunamadı."); } }
        catch (error) { if (token === generation.current) setStatus((error as Error).message); }
        finally { if (token === generation.current) setBusy(false); }
    }}>Seçili alandaki yazıyı oku</button><p role="status">{busy ? "İşleniyor…" : status}</p><textarea aria-label="Okunan yazı" value={text} onChange={e => setText(e.target.value)} /><button disabled={!text} onClick={() => void navigator.clipboard.writeText(text).then(() => setStatus("Panoya kopyalandı."), () => setStatus("Kopyalanamadı. Metni seçip Ctrl+C kullan."))}>Yazıyı kopyala</button></section>;
}
