/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { hyperTranslate as t } from "@utils/hyperLanguage";
import { React, UserStore, useStateFromStores } from "@webpack/common";

import { PersonalItem, validateItems } from "./core";
import { createPersonalStorage } from "./storage";

const listeners = new Set<() => void>();
let revision = 0;
const storage = createPersonalStorage(DataStore);
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function usePersonalItems(namespace: string) {
    const owner = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id);
    const version = React.useSyncExternalStore(subscribe, () => revision);
    const [loaded, setLoaded] = React.useState<{ key: string; rows: PersonalItem[]; }>();
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const key = owner ? `${namespace}:v1:${owner}` : "";
    React.useEffect(() => {
        let live = true;
        setError("");
        if (key) DataStore.get(key).then(value => {
            if (live) setLoaded({ key, rows: validateItems(value) });
        }).catch(() => { if (live) setError(t("Local data could not be loaded. Reopen this window to retry.")); });
        return () => { live = false; };
    }, [key, version]);
    const ready = !!key && loaded?.key === key;
    async function update(change: (rows: PersonalItem[]) => PersonalItem[]) {
        if (!ready || busy) return false;
        setBusy(true);
        try {
            const saved = await storage.update(key, () => UserStore.getCurrentUser()?.id === owner, change);
            if (!saved) return false;
            revision++;
            listeners.forEach(fn => fn());
            setError("");
            return true;
        }
        catch { setError(t("Changes could not be saved. Please try again.")); return false; }
        finally { setBusy(false); }
    }
    return { rows: ready ? loaded.rows : [], ready, busy, error, update };
}

export function ToolIcon({ kind = "list", width = 24, height = 24 }: { kind?: "list" | "bookmark" | "clock"; width?: number | string; height?: number | string; }) {
    return <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        {kind === "clock" ? <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>
            : kind === "bookmark" ? <path d="M6 3h12v18l-6-4-6 4z" />
                : <><path d="m3 6 2 2 3-4m3 3h10M3 13h4m4 0h10M3 19h4m4 0h10" /></>}
    </svg>;
}
