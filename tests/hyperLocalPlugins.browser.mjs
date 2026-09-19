import assert from 'node:assert/strict';
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';

const bundle = await build({ entryPoints: ['src/plugins/hyperLocalPlugins/sandbox.ts'], bundle: true, format: 'iife', globalName: 'LocalPlugins', write: false });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
    const page = await browser.newPage();
    let externalRequests = 0;
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (/^https?:/.test(request.url())) { externalRequests++; void request.abort(); }
        else void request.continue();
    });
    await page.setContent('<!doctype html><body></body>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const run = (code, input) => page.evaluate(async (code, input) => {
        return await new Promise(resolve => {
            let instance;
            const timeout = setTimeout(() => { instance.stop(); resolve({ timeout: true }); }, 20000);
            instance = LocalPlugins.startSandbox(code, text => {
                if (text === 'ready-input') { instance.input(input); return; }
                clearTimeout(timeout); instance.stop(); resolve({ text });
            }, error => { clearTimeout(timeout); resolve({ error }); });
        });
    }, code, input);
    assert.deepEqual(await run('module.exports={start(api){api.show("OK")}}'), { text: 'OK' });
    assert.deepEqual(await run('module.exports={start(api){api.show("ready-input")},onInput(api,text){api.show(text.toUpperCase())}}', 'hello'), { text: 'HELLO' });
    const form = await page.evaluate(async () => new Promise(resolve => {
        let saved;
        const instance = LocalPlugins.startSandbox(`module.exports={start(api){api.ui([{id:'go',type:'button',label:'Çalıştır'}])},async onAction(api,id,values){await api.settings.set({count:api.settings.get().count+1});api.show(id+':'+values.text+':'+api.settings.get().count)}}`, text => { instance.stop(); resolve({text,saved}); }, error => { instance.stop(); resolve({error}); }, {
            settings: {count: 2},
            ui(json) { const controls=JSON.parse(json); instance.action(controls[0].id,{text:'chosen text'}); },
            async save(json) { saved=JSON.parse(json); }
        });
    }));
    assert.deepEqual(form, {text:'go:chosen text:3',saved:{count:3}});
    assert.deepEqual(await run('module.exports={async start(api){try{await api.settings.set({x:1});api.show("UNSAFE")}catch{api.show("denied")}}}'), {text:'denied'});
    const isolation = await run(`module.exports={async start(api){
        const result={node:typeof require,process:typeof process,document:typeof document,bridge:typeof VencordNative};
        try{await fetch('https://example.com/hyperdc-test');result.network='open'}catch{result.network='blocked'}
        try{indexedDB.open('test');result.storage='open'}catch{result.storage='blocked'}
        api.show(JSON.stringify(result));
    }}`);
    assert.deepEqual(JSON.parse(isolation.text), { node: 'undefined', process: 'undefined', document: 'undefined', bridge: 'undefined', network: 'blocked', storage: 'blocked' });
    assert.equal(externalRequests, 0);
    assert.ok((await run('module.exports={start(){throw Error("test failure")}}')).error.includes('test failure'));
    assert.ok((await run('module.exports={start(){while(true){}}}')).error.includes('yanıt vermiyor'));
    assert.equal(await page.$('iframe'), null);
    console.log('PASS: output, user input, opaque storage, no network or account bridge, errors, infinite-loop termination, frame cleanup');
} finally { await browser.close(); }
