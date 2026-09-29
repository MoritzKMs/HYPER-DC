/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import type { ModalProps } from "@vencord/discord-types";
import { React } from "@webpack/common";

export function HyperModal({ title, children, onClose, subtitle, actions }: Pick<ModalProps, "title" | "children" | "onClose" | "subtitle" | "actions">) {
    const root = React.useRef<HTMLDivElement>(null);
    const heading = React.useId();
    React.useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        root.current?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, []);
    return <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={heading}
        onClick={event => event.stopPropagation()}
        onMouseDown={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
        style={{ width: "min(620px, 92vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", background: "var(--background-primary, #23252c)", color: "var(--text-normal, #eee)", border: "1px solid #555", borderRadius: 12, boxShadow: "0 12px 50px #0008", outline: "none" }}
        onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
            if (event.key === "Tab") {
                const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
                const first = elements[0], last = elements.at(-1);
                if (!first) { event.preventDefault(); return; }
                if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottom: "1px solid #555" }}><h2 id={heading} style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2><button type="button" aria-label="Kapat" onClick={onClose} style={{ background: "transparent", color: "inherit", padding: 8, cursor: "pointer", fontSize: 24 }}>×</button></header>
        <div style={{ padding: 20, overflowY: "auto", minHeight: 0 }}>
            {subtitle && <p>{subtitle}</p>}
            <ErrorBoundary fallback={() => <p role="alert">Bu araç açılırken hata oluştu. Kayıtların silinmedi; pencereyi kapatıp tekrar deneyebilirsin.</p>}>{children}</ErrorBoundary>
        </div>
        {actions?.length ? <footer style={{ padding: 16 }}>{actions.map((action, index) => <button type="button" key={index} disabled={action.disabled || action.loading} onClick={action.onClick}>{action.text}</button>)}</footer> : null}
    </div>;
}
