/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { hyperTranslate } from "@utils/hyperLanguage";
import { React } from "@webpack/common";

import { LibraryTrack } from "./library";
import { downloadTrack, loadLibrary } from "./libraryClient";

export function MusicLibrary({ busy, setBusy, setStatus, onLoad, onQueue }: {
    busy: boolean;
    setBusy(value: boolean): void;
    setStatus(value: string): void;
    onLoad(file: File, title: string): void;
    onQueue(tracks: LibraryTrack[]): void;
}) {
    const [tracks, setTracks] = React.useState<LibraryTrack[]>([]);
    const [selected, setSelected] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const fetching = React.useRef(false);
    const alive = React.useRef(true);
    async function refresh(manual = false) {
        if (fetching.current) return;
        fetching.current = true;
        setLoading(true);
        try {
            const result = await loadLibrary();
            if (!alive.current) return;
            setTracks(result);
            setSelected(previous => result.some(t => t.file === previous) ? previous : result[0]?.file ?? "");
            if (manual) setStatus(hyperTranslate(result.length ? "Choose a track from the library and load it." : "The music library is empty."));
        } catch {
            if (alive.current) setStatus(hyperTranslate("Could not load the GitHub library. Try again or choose a local MP3."));
        } finally {
            fetching.current = false;
            if (alive.current) setLoading(false);
        }
    }
    React.useEffect(() => {
        alive.current = true;
        void refresh();
        const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
        return () => { alive.current = false; clearInterval(timer); setBusy(false); };
    }, []);
    async function run(action: () => Promise<void>, error: string) {
        setBusy(true);
        try { await action(); }
        catch { if (alive.current) setStatus(hyperTranslate(error)); }
        finally { if (alive.current) setBusy(false); }
    }
    return <div className="hyper-deck-effects">
        <strong>{hyperTranslate("GitHub music library")}</strong>
        <small>{hyperTranslate("New MP3s appear automatically when the menu opens and every 5 minutes.")}</small>
        <small>Parçalar ihtiyaç oldukça indirilir. İndirilenler 128 MB yerel önbellekte tutulur; aynı dosya tekrar indirilmez.</small>
        <button disabled={busy || loading} onClick={() => void refresh(true)}>{hyperTranslate(loading ? "Loading music library…" : "Refresh library")}</button>
        {tracks.length > 0 && <>
            <button disabled={busy} onClick={() => onQueue(tracks)}>Tüm arşivi sıraya koy · {tracks.length} parça</button>
            <select aria-label={hyperTranslate("Choose library track")} disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}>
                {tracks.map(track => <option key={track.file} value={track.file}>{track.title}</option>)}
            </select>
            <button disabled={busy || !selected} onClick={() => void run(async () => {
                const track = tracks.find(t => t.file === selected);
                if (!track) return;
                setStatus(hyperTranslate("Downloading track from GitHub…"));
                const file = await downloadTrack(track);
                if (alive.current) onLoad(file, track.title);
            }, "Could not download or verify the track. Try again or choose a local MP3.")}>{hyperTranslate("Load selected track")}</button>
        </>}
    </div>;
}
