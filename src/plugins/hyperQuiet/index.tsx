/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, GuildStore, React, RestAPI, UserGuildSettingsStore, UserStore } from "@webpack/common";

import { buildPatch, mergeBackup, NotificationPatch, restorePatch } from "./core";

const settings = definePluginSettings({
    mode: { type: OptionType.SELECT, description: "Bildirim modu", options: [
        { label: "Tamamen sustur", value: 2, default: true },
        { label: "Yalnızca bahsetmeler", value: 1 }
    ] },
    everyone: { type: OptionType.BOOLEAN, description: "@everyone ve @here bildirimlerini bastır", default: true },
    roles: { type: OptionType.BOOLEAN, description: "Rol bahsetmelerini bastır", default: true },
    events: { type: OptionType.BOOLEAN, description: "Etkinlik bildirimlerini sustur", default: true },
    highlights: { type: OptionType.BOOLEAN, description: "Öne çıkanları bastır", default: true },
    mobile: { type: OptionType.BOOLEAN, description: "Mobil push bildirimlerine izin ver", default: false },
    channels: { type: OptionType.BOOLEAN, description: "Mevcut kanal bildirim istisnalarını da aynı moda al", default: true }
});
interface AccountData { excluded: string[]; backups: Record<string, NotificationPatch>; }
let running = false;
let cancelled = false;
let active = false;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const accountId = () => UserStore.getCurrentUser()?.id;
const keyFor = (id: string) => `HyperQuiet:v1:${id}`;
async function load(id: string): Promise<AccountData> {
    return await DataStore.get<AccountData>(keyFor(id)) ?? { excluded: [], backups: {} };
}
function snapshot(id: string, includeChannels: boolean): NotificationPatch {
    const s = UserGuildSettingsStore;
    return {
        muted: s.isMuted(id), mute_config: s.getMuteConfig(id),
        message_notifications: s.getMessageNotifications(id),
        suppress_everyone: s.isSuppressEveryoneEnabled(id), suppress_roles: s.isSuppressRolesEnabled(id),
        mute_scheduled_events: s.isMuteScheduledEventsEnabled(id), notify_highlights: s.getNotifyHighlights(id),
        mobile_push: s.isMobilePushEnabled(id),
        ...(includeChannels ? { channel_overrides: Object.fromEntries(Object.entries(s.getChannelOverrides(id)).map(([cid, c]) => [cid, {
            muted: c.muted, mute_config: c.mute_config, message_notifications: c.message_notifications
        }])) } : {})
    };
}
async function writeSettings(id: string, body: NotificationPatch) {
    const response = await RestAPI.patch({ url: `/users/@me/guilds/${id}/settings`, body });
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    FluxDispatcher.dispatch({ type: "USER_GUILD_SETTINGS_GUILD_UPDATE", guildId: id, settings: response.body ?? body });
}
function Manager() {
    const [data, setData] = React.useState<AccountData>({ excluded: [], backups: {} });
    const [owner, setOwner] = React.useState<string>();
    const [ready, setReady] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [busy, setBusy] = React.useState(running);
    const [message, setMessage] = React.useState("Sunucu seçimi yükleniyor…");
    const [confirmed, setConfirmed] = React.useState(false);
    React.useEffect(() => {
        let mounted = true;
        const id = accountId();
        if (id) load(id).then(value => {
            if (mounted) { setData(value); setOwner(id); setReady(true); setMessage("Hariç tutulan sunuculara dokunulmaz. İşlem Discord hesabındaki ayarları değiştirir."); }
        }).catch(() => { if (mounted) setMessage("Yerel ayarlar okunamadı. İşlem başlatılmadı."); });
        return () => { mounted = false; };
    }, []);
    const guilds = Object.values(GuildStore.getGuilds()).sort((a, b) => a.name.localeCompare(b.name));
    const targets = guilds.filter(g => !data.excluded.includes(g.id));
    async function exclude(id: string, checked: boolean) {
        if (!owner || owner !== accountId() || running) return;
        const next = { ...data, excluded: checked ? [...new Set([...data.excluded, id])] : data.excluded.filter(x => x !== id) };
        setBusy(true);
        try { await DataStore.set(keyFor(owner), next); setData(next); setConfirmed(false); }
        catch { setMessage("İstisna kaydedilemedi; önceki seçim korundu."); }
        finally { setBusy(false); }
    }
    async function run(restore: boolean) {
        if (!owner || owner !== accountId() || !ready || running) return;
        if (!restore && !confirmed) return;
        running = true; cancelled = false; setBusy(true);
        let ok = 0;
        let failed = 0;
        const options = { ...settings.store };
        try {
            const work = await load(owner);
            const ids = restore ? Object.keys(work.backups).filter(id => GuildStore.getGuild(id)) : targets.map(g => g.id);
            for (const id of ids) {
                if (cancelled || !active || accountId() !== owner) break;
                setMessage(`${restore ? "Geri alınıyor" : "Uygulanıyor"}: ${ok + failed + 1}/${ids.length} · ${GuildStore.getGuild(id)?.name ?? id}`);
                try {
                    const channelIds = Object.keys(UserGuildSettingsStore.getChannelOverrides(id));
                    if (!restore) {
                        work.backups[id] = mergeBackup(work.backups[id], snapshot(id, options.channels));
                        await DataStore.set(keyFor(owner), work);
                    }
                    if (cancelled || !active || accountId() !== owner) break;
                    const body = restore
                        ? restorePatch(work.backups[id], new Set(Object.keys(work.backups[id].channel_overrides as object ?? {}).filter(cid => ChannelStore.getChannel(cid))))
                        : buildPatch(options, channelIds);
                    await writeSettings(id, body);
                    if (restore) { delete work.backups[id]; await DataStore.set(keyFor(owner), work); }
                    ok++;
                } catch { failed++; }
                if (failed) break;
                await pause(1100);
            }
            setData(work);
            setMessage(`${ok} sunucu ${restore ? "geri alındı" : "güncellendi"}.${failed ? " Bir hata oluştu; istek göndermeye devam edilmedi. Kalan yedekler korunuyor." : ""}${cancelled || accountId() !== owner ? " İşlem durduruldu." : ""}`);
        } catch { setMessage("Yerel yedek okunamadı veya kaydedilemedi. İşlem durduruldu."); }
        finally { running = false; setBusy(false); setConfirmed(false); }
    }
    return <div className="hyper-quiet">
        <h2>HYPER Quiet</h2>
        <p>Sunucularını tek seferde sustur. Bildirimleri açık kalacak sunucuları aşağıdan hariç tut; onların mevcut ayarları korunur.</p>
        <input aria-label="Sunucu ara" placeholder="Sunucu adıyla ara…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="hyper-quiet-list">{guilds.filter(g => g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(g => <label key={g.id}>
            <input type="checkbox" disabled={busy || !ready} checked={data.excluded.includes(g.id)} onChange={e => void exclude(g.id, e.target.checked)} />
            <span>{g.name}<small>{data.excluded.includes(g.id) ? "Hariç — mevcut ayarlar korunur" : "Uygulanacak"}</small></span>
        </label>)}</div>
        <p>{targets.length} sunucuya uygulanacak · {data.excluded.length} istisna · {Object.keys(data.backups).length} yedek</p>
        <label className="hyper-quiet-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> Seçili olmayan sunuculara aşağıdaki ayarları uygula.</label>
        <div className="hyper-quiet-actions"><button disabled={!ready || busy || !confirmed || !targets.length} onClick={() => void run(false)}>Ayarları uygula</button>
            <button disabled={!ready || busy || !Object.keys(data.backups).length} onClick={() => void run(true)}>Yedekten geri al</button>
            <button disabled={!running} onClick={() => { cancelled = true; setMessage("Devam eden istek tamamlanınca durdurulacak."); }}>Durdur</button></div>
        <p role="status" aria-live="polite">{message}</p>
        <small>Geri alma, bu eklentinin değiştirdiği alanları ilk yedeğe döndürür. Sonradan yaptığın değişiklikleri de bu alanlarda geri alır. DM bildirimleri değişmez. Eklentiyi kapatmak ayarları geri almaz.</small>
    </div>;
}
export default definePlugin({
    name: "HyperQuiet",
    description: "Toplu sunucu bildirim yönetimi, sunucu istisnaları ve hesaba özel geri alma. HYPER DC.",
    authors: [{ name: "HYPER DC", id: 0n }],
    tags: ["Notifications", "Servers"],
    enabledByDefault: true,
    settings,
    settingsAboutComponent: Manager,
    start() { active = true; },
    stop() { active = false; cancelled = true; }
});
