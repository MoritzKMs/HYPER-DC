/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Plugin source is sent as data to an opaque-origin frame, never evaluated in Discord.
const frameDocument = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'; img-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><script>
let worker, port;
addEventListener('pagehide',()=>worker?.terminate());
addEventListener('message', function init(e) {
 if(e.source!==parent || port || !e.ports[0]) return;
 port=e.ports[0];
 const workerCode = \`const send = postMessage.bind(self);
 let plugin, settings={}, pending;
 const api=Object.freeze({
  show(text){send({type:'text',text:String(text).slice(0,4000)})},
  ui(controls){send({type:'ui',text:JSON.stringify(controls)})},
  settings:Object.freeze({get(){return {...settings}},set(value){
   if(pending)return Promise.reject(Error('Önceki kayıt henüz tamamlanmadı.'));
   const text=JSON.stringify(value);
   return new Promise((resolve,reject)=>{pending={resolve,reject,value:JSON.parse(text)};send({type:'save',text})});
  }})
 });
 onmessage = e => {
  if(e.data.type==='ping'){send({type:'pong'});return;}
  if(e.data.type==='saved'){if(pending){const p=pending;pending=null;if(e.data.error)p.reject(Error(e.data.error));else{settings=p.value;p.resolve()}}return;}
  if(e.data.type==='action'){
   try {Promise.resolve(plugin?.onAction?.(api,e.data.id,e.data.values)).catch(e=>send({type:'error',text:String(e).slice(0,500)}));}
   catch(e){send({type:'error',text:String(e).slice(0,500)});}
   return;
  }
  if(e.data.type==='input'){
   try {Promise.resolve(plugin?.onInput?.(api,e.data.text)).catch(e=>send({type:'error',text:String(e).slice(0,500)}));}
   catch(e){send({type:'error',text:String(e).slice(0,500)});}
   return;
  }
  if(e.data.type!=='load')return;
  try {
   settings=e.data.settings || {};
   const module={exports:{}};
   new Function('module','exports',e.data.code)(module,module.exports);
   if(typeof module.exports.start!=='function')throw Error('start(api) gerekli.');
   plugin=module.exports;
   Promise.resolve(plugin.start(api)).catch(e=>send({type:'error',text:String(e).slice(0,500)}));
  } catch(e){send({type:'error',text:String(e).slice(0,500)});}
 };\`;
 const url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'}));
 try {
  worker=new Worker(url);
  worker.onmessage=e=>{const d=e.data;if(d && ['text','error','pong','ui','save'].includes(d.type))port.postMessage({type:d.type,text:typeof d.text==='string'?d.text.slice(0,16001):''});};
  worker.onerror=()=>port.postMessage({type:'error',text:'Eklenti iş parçacığı hata verdi.'});
  port.onmessage=e=>{if(e.data.type==='stop'){worker.terminate();port.close();return;}if(['load','ping','input','action','saved'].includes(e.data.type))worker.postMessage(e.data);};
  port.postMessage({type:'ready'});
 } catch(e){port.postMessage({type:'error',text:'İzole çalışma ortamı açılamadı.'});}
 finally {URL.revokeObjectURL(url);}
});
</script>`;

export function startSandbox(code: string, output: (text: string) => void, failure: (text: string) => void, options: {
    settings?: Record<string, string | number | boolean | null>;
    ui?: (json: string) => void;
    save?: (json: string) => Promise<void>;
} = {}) {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("allow", "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
    frame.hidden = true;
    const channel = new MessageChannel();
    let stopped = false;
    let last = Date.now();
    let count = 0;
    let windowStart = Date.now();
    let saving = false;
    let lastSave = 0;
    const stop = () => { if (stopped) return; stopped = true; clearInterval(timer); channel.port1.postMessage({ type: "stop" }); channel.port1.close(); channel.port2.close(); frame.remove(); };
    const fail = (text: string) => { stop(); failure(text); };
    channel.port1.onmessage = event => {
        if (stopped) return;
        const now = Date.now();
        if (now - windowStart > 1000) { count = 0; windowStart = now; }
        if (++count > 40) { fail("Eklenti çok fazla çıktı üretti ve durduruldu."); return; }
        const { data } = event;
        if (!data || typeof data.type !== "string") return;
        if (data.type === "ready") channel.port1.postMessage({ type: "load", code, settings: options.settings ?? {} });
        else if (data.type === "pong") last = now;
        else if (data.type === "text" && typeof data.text === "string") output(data.text.slice(0, 4000));
        else if (data.type === "ui" && typeof data.text === "string") { try { options.ui?.(data.text); } catch (e) { fail(String(e)); } }
        else if (data.type === "save" && typeof data.text === "string") {
            if (!options.save || saving || now - lastSave < 1000) { channel.port1.postMessage({ type: "saved", error: "Kayıt izni yok veya çok sık kayıt isteği gönderildi." }); return; }
            saving = true; lastSave = now;
            Promise.resolve().then(() => { if (!stopped) return options.save!(data.text); }).then(() => {
                if (!stopped) channel.port1.postMessage({ type: "saved" });
            }, () => { if (!stopped) channel.port1.postMessage({ type: "saved", error: "Ayarlar kaydedilemedi. Boyutu ve veri biçimini kontrol et." }); }).finally(() => { saving = false; });
        }
        else if (data.type === "error") fail(typeof data.text === "string" ? data.text.slice(0, 500) : "Eklenti hatası.");
    };
    const timer = setInterval(() => { if (Date.now() - last > 15000) fail("Eklenti yanıt vermiyor; durduruldu."); else channel.port1.postMessage({ type: "ping" }); }, 2000);
    frame.onload = () => { if (!stopped) frame.contentWindow?.postMessage({ type: "init" }, "*", [channel.port2]); };
    frame.srcdoc = frameDocument;
    document.body.appendChild(frame);
    return { stop,
        action(id: string, values: Record<string, string | boolean>) { if (!stopped) channel.port1.postMessage({ type: "action", id, values }); },
        input(text: string) { if (!stopped) channel.port1.postMessage({ type: "input", text: text.slice(0, 4000) }); }
    };
}
