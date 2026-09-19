/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@utils/hyperTools/style.css";

import * as DataStore from "@api/DataStore";
import definePlugin, { PluginNative } from "@utils/types";
import { closeModal, Modal, openModal, React } from "@webpack/common";

import { startSandbox } from "./sandbox";
import { Control, parseControls, parseSettings } from "./schema";

const native = () => VencordNative.pluginHelpers.HyperLocalPlugins as PluginNative<typeof import("./native")>;
const outputs = new Map<string, string>();
const running = new Map<string, ReturnType<typeof startSandbox>>();
const forms = new Map<string, Control[]>();
const settingsKey = (name: string, hash: string) => `HyperLocalPlugins:${encodeURIComponent(name)}:${hash}`;
const errors = new Map<string, string>();
const busy = new Set<string>();
let alive = false;
let generation = 0;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => { revision++; listeners.forEach(f => f()); };
async function unload(name: string) {
    const plugin = running.get(name); running.delete(name);
    if (!plugin) return;
    try { await plugin.stop(); } catch (e) { errors.set(name, String(e)); }
    finally { forms.delete(name); emit(); }
}
async function load(name: string, expected: string, allowStorage: boolean) {
    if (busy.has(name)) return;
    busy.add(name); errors.delete(name); emit();
    const session = generation;
    const cleanups: Array<() => void> = [];
    try {
        const file = await native().read(name);
        if (file.hash !== expected) throw Error("Dosya değişti. Kodu yeniden inceleyip etkinleştir.");
        const key = settingsKey(name, file.hash);
        const settings = allowStorage ? parseSettings(await DataStore.get<string>(key) ?? "{}") : {};
        if (!alive || generation !== session) return;
        await unload(name);
        if (!alive || generation !== session) return;
        if (running.size >= 4) throw Error("Aynı anda en fazla 4 yerel eklenti çalıştırılabilir.");
        outputs.delete(name);
        const sandbox = startSandbox(file.code, text => { outputs.set(name, text); emit(); }, error => { errors.set(name, error); void unload(name); }, {
            settings,
            ui(json) { forms.set(name, parseControls(json)); emit(); },
            save: allowStorage ? async json => {
                const value = parseSettings(json);
                if (!alive || generation !== session || running.get(name) !== sandbox) throw Error("Eklenti durduruldu.");
                await DataStore.set(key, JSON.stringify(value));
            } : undefined
        });
        cleanups.push(sandbox.stop);
        running.set(name, sandbox);
    } catch (e) {
        await unload(name);
        for (const clean of cleanups.reverse()) try { clean(); } catch {}
        errors.set(name, String(e));
    } finally { busy.delete(name); emit(); }
}
const example = `module.exports = {
  start(api) {
    api.show("Bir metin yazıp Gönder'e bas: karakter ve kelime sayısını göstereceğim.");
  },
  onInput(api, text) {
    const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
    api.show(text.length + " karakter, " + words + " kelime");
  }
};`;
function PluginForm({ name, controls }: { name: string; controls: Control[]; }) {
    const [values, setValues] = React.useState<Record<string, string | boolean>>({});
    return <fieldset><legend>Eklenti formu · {name}</legend>{controls.map(control => {
        const { id, type, label } = control;
        if (type === "button") return <button key={id} type="button" onClick={() => {
            const fields = Object.fromEntries(controls.filter(c => c.type !== "button").map(c => [c.id, values[c.id] ?? (c.type === "checkbox" ? false : "")]));
            running.get(name)?.action(id, fields);
        }}>{label}</button>;
        if (type === "checkbox") return <label key={id}><input type="checkbox" checked={values[id] === true} onChange={e => setValues(old => ({ ...old, [id]: e.target.checked }))} />{label}</label>;
        const props = { "aria-label": label, maxLength: 4000, value: typeof values[id] === "string" ? values[id] as string : "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues(old => ({ ...old, [id]: e.target.value })) };
        return <label key={id}>{label}{type === "textarea" ? <textarea {...props} /> : <input type="text" {...props} />}</label>;
    })}</fieldset>;
}
function Panel() {
    React.useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => revision);
    const [files, setFiles] = React.useState<string[]>([]);
    const [path, setPath] = React.useState("");
    const [status, setStatus] = React.useState("");
    const [review, setReview] = React.useState<{ name: string; code: string; hash: string; }>();
    const [trusted, setTrusted] = React.useState(false);
    const [allowStorage, setAllowStorage] = React.useState(false);
    const [inputs, setInputs] = React.useState<Record<string, string>>({});
    async function refresh() { try { const list = await native().list(); setFiles(list.files); setPath(list.path); } catch (e) { setStatus(String(e)); } }
    React.useEffect(() => { void refresh(); }, []);
    return <div className="hyper-tools"><p>Kendi JavaScript dosyanı <b>.plugin.js</b> uzantısıyla bu klasöre koy. Derleme gerekmez. Bu sürümde her Discord açılışında elle etkinleştirilir.</p><code>{path}</code><p>Eklentiler izole bir iş parçacığında çalışır. Kendi panelinde buton ve form oluşturabilir, verdiğin metni işleyebilir ve ayrıca izin verirsen kendi ayarlarını saklayabilir; Discord mesajlarına, hesabına, dosyalara ve ağa erişim verilmez. Etkinleştirme yalnızca bu oturum içindir.</p><div className="hyper-tools-actions"><button onClick={() => void native().openFolder().catch(e => setStatus(String(e)))}>Klasörü aç</button><button onClick={() => void refresh()}>Listeyi yenile</button></div><p role="status">{status}</p>
        {[...new Set([...files, ...running.keys()])].map(name => <article key={name}><strong>{name}</strong><p>{running.has(name) ? "Çalışıyor" : "Kapalı"}</p><button disabled={busy.has(name) || !files.includes(name)} onClick={async () => { try { const file = await native().read(name); setReview({ name, ...file }); setTrusted(false); setAllowStorage(false); } catch (e) { setStatus(String(e)); } }}>Kodu incele / yükle</button><button disabled={!running.has(name) || busy.has(name)} onClick={() => void unload(name)}>Durdur</button>{running.has(name) && <div><textarea aria-label={`${name} için metin`} maxLength={4000} value={inputs[name] ?? ""} onChange={e => setInputs(previous => ({ ...previous, [name]: e.target.value }))} /><button onClick={() => running.get(name)?.input(inputs[name] ?? "")}>Gönder</button></div>}{running.has(name) && forms.has(name) && <PluginForm key={JSON.stringify(forms.get(name))} name={name} controls={forms.get(name)!} />}{outputs.has(name) && <p style={{ whiteSpace: "pre-wrap" }}>{outputs.get(name)}</p>}{errors.has(name) && <p role="alert">{errors.get(name)}</p>}</article>)}
        {review && <section><h3>{review.name}</h3><textarea readOnly aria-label="Eklenti kaynak kodu" value={review.code} style={{ width: "100%", height: 220 }} /><label><input type="checkbox" checked={trusted} onChange={e => setTrusted(e.target.checked)} /> Bu kodu inceledim ve çalıştırılmasına güveniyorum.</label><label><input type="checkbox" checked={allowStorage} onChange={e => setAllowStorage(e.target.checked)} /> Bu eklentinin kendi ayarlarını bu cihazda saklamasına izin ver.</label><button onClick={() => void DataStore.del(settingsKey(review.name, review.hash)).then(() => setStatus("Bu kod sürümünün kayıtlı ayarları silindi."), e => setStatus(String(e)))}>Kayıtlı ayarları sil</button><button disabled={!trusted || busy.has(review.name)} onClick={() => { void load(review.name, review.hash, allowStorage); setReview(undefined); }}>Etkinleştir / yeniden yükle</button></section>}
        <details><summary>Örnek eklenti ve kullanım</summary><p>örnek.plugin.js yerine ornek.plugin.js gibi Latin harfli bir dosya adı kullan. CommonJS biçimi desteklenir. start(api) gerekli; api.show(text) kendi paneline metin yazar. İsteğe bağlı onInput(api, text), Gönder düğmesine basıldığında çağrılır. api.ui(controls) form oluşturur; onAction(api, id, values) düğmeye basılınca çağrılır. api.settings.get() kayıtlı ayarları verir, await api.settings.set(nesne) ayarları kaydeder. Vencord API, DOM, import, JSX ve npm paketleri desteklenmez. Durdur düğmesi iş parçacığını sonlandırır.</p><pre style={{ whiteSpace: "pre-wrap" }}>{example}</pre><p>Güvendiğin kodları kullan: izolasyon kötü niyetli kodun bellek ve işlemci tüketmesini tamamen engellemez. Zamanlayıcılar kullanılabilir. Yanıt vermeyen eklentiler otomatik durdurulur; dosya değişirse yeniden inceleyip etkinleştirmen gerekir.</p></details></div>;
}
function open() { openModal(props => <Modal {...props} title="HyperDC · Yerel JS eklentileri"><Panel /></Modal>, { modalKey: "hyper-local-plugins" }); }
export default definePlugin({
    name: "HyperLocalPlugins", description: "Kendi .plugin.js dosyalarını yerelden incele, çalıştır, durdur ve yeniden yükle.", authors: [{ name: "HyperDC", id: 0n }], enabledByDefault: true,
    settingsAboutComponent: Panel, toolboxActions: { "Yerel JS eklentileri": open },
    start() { alive = true; generation++; }, stop() { alive = false; generation++; closeModal("hyper-local-plugins"); for (const name of running.keys()) void unload(name); }
});
