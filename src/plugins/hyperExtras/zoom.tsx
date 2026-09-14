/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";

export function Zoom() {
    const [sources, setSources] = React.useState<HTMLVideoElement[]>([]);
    const [selected, setSelected] = React.useState<HTMLVideoElement>();
    const [scale, setScale] = React.useState(2);
    const [origin, setOrigin] = React.useState("50% 50%");
    const [status, setStatus] = React.useState("");
    const target = React.useRef<HTMLVideoElement>(null);
    const refresh = () => setSources(Array.from(document.querySelectorAll("video")).filter(v => v !== target.current && v.srcObject instanceof MediaStream && v.srcObject.getVideoTracks().length > 0));
    React.useEffect(refresh, []);
    React.useEffect(() => {
        const output = target.current;
        if (!output || !selected || !(selected.srcObject instanceof MediaStream)) return;
        // Borrow the stream; never stop Discord's tracks.
        output.srcObject = selected.srcObject;
        void output.play().catch(() => setStatus("Ön izleme başlatılamadı."));
        const timer = setInterval(() => { if (!selected.isConnected || selected.srcObject !== output.srcObject) { output.pause(); output.srcObject = null; setStatus("Yayın değişti veya kapandı. Listeyi yenile."); } }, 1000);
        return () => { clearInterval(timer); output.pause(); output.srcObject = null; };
    }, [selected]);
    return <section><h3>Yayın yakınlaştırma</h3><p>Önce Discord’da yayını aç. Görüntü yalnızca sende büyür; fareyi ön izleme üzerinde gezdirerek bölge seç.</p><button onClick={refresh}>Açık yayınları yenile</button><select aria-label="Yayın seç" value={selected ? sources.indexOf(selected) : -1} onChange={e => { setStatus(""); setSelected(sources[Number(e.target.value)]); }}><option value={-1}>Yayın seç</option>{sources.map((v, i) => <option key={i} value={i}>Görüntü {i + 1} · {v.videoWidth} × {v.videoHeight}</option>)}</select><label>Yakınlık · {scale}×<input type="range" min="1" max="5" step="0.25" value={scale} onChange={e => setScale(Number(e.target.value))} /></label><div className="hyper-extra-zoom" onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setOrigin(`${(e.clientX - rect.left) / rect.width * 100}% ${(e.clientY - rect.top) / rect.height * 100}%`); }}><video ref={target} muted playsInline style={{ transform: `scale(${scale})`, transformOrigin: origin }} /></div><p role="status">{status || (!sources.length ? "Etkin yayın görüntüsü bulunamadı." : "Ön izleme sessizdir; yayın sesi Discord’dan gelmeye devam eder.")}</p></section>;
}
