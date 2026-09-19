import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { build } from 'esbuild';

test('forms and settings reject unsafe, oversized or ambiguous data', async () => {
    const bundle = await build({ entryPoints: ['src/plugins/hyperLocalPlugins/schema.ts'], bundle: true, format: 'esm', write: false });
    const {parseControls, parseSettings} = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
    const button={id:'go',type:'button',label:'Go'};
    assert.deepEqual(parseControls(JSON.stringify([button])),[button]);
    for(const value of [[button,button],[{...button,id:'constructor'}],[{...button,type:'html'}],Array(13).fill(button)]) assert.throws(()=>parseControls(JSON.stringify(value)));
    assert.deepEqual(parseSettings('{"flag":true,"count":2}'),{flag:true,count:2});
    for(const text of ['[]','{"constructor":"x"}','{"nested":{}}',JSON.stringify({x:'a'.repeat(16000)})]) assert.throws(()=>parseSettings(text));
});

test('local plugin reader restricts paths, sizes, extensions and hashes reviewed content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hyper-local-test-'));
    try {
        const bundle = await build({ entryPoints: ['src/plugins/hyperLocalPlugins/native.ts'], bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{
            name: 'test-native-dependencies', setup(b) {
                b.onResolve({ filter: /^(@main\/utils\/constants|electron)$/ }, args => ({ path: args.path, namespace: 'mock' }));
                b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'electron' ? 'export const shell={openPath:async()=>""};' : `export const DATA_DIR=${JSON.stringify(root)};` }));
            }
        }] });
        const native = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
        assert.deepEqual((await native.list()).files, []);
        const folder = join(root, 'local-plugins');
        const source = 'module.exports={start(api){api.show("Hello")}};';
        await writeFile(join(folder, 'example.plugin.js'), source);
        await writeFile(join(folder, 'ignored.js'), source);
        await mkdir(join(folder, 'directory.plugin.js'));
        assert.deepEqual((await native.list()).files, ['example.plugin.js']);
        assert.deepEqual(await native.read(null, 'example.plugin.js'), { code: source, hash: createHash('sha256').update(source).digest('hex') });
        for (const name of ['../secret.plugin.js', '..\\secret.plugin.js', 'C:\\secret.plugin.js', 'example.plugin.js:stream', 'ignored.js', 'directory.plugin.js']) await assert.rejects(native.read(null, name));
        await writeFile(join(folder, 'large.plugin.js'), Buffer.alloc(512 * 1024 + 1));
        await assert.rejects(native.read(null, 'large.plugin.js'));
        await writeFile(join(folder, 'example.plugin.js'), source + '\n');
        assert.notEqual((await native.read(null, 'example.plugin.js')).hash, createHash('sha256').update(source).digest('hex'));
    } finally { await rm(root, { recursive: true, force: true }); }
});
