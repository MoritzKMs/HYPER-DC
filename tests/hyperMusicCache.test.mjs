import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const data = new Map();
globalThis.__musicCache = data;
globalThis.IS_DISCORD_DESKTOP = true;
let requests = [];
const catalog = [{ type: 'file', name: 'song.mp3', size: 3, sha: 'a'.repeat(40) }];
globalThis.VencordNative = { pluginHelpers: { HyperDeck: { readLibraryFile: async file => {
    requests.push(file);
    return file === 'catalog.json' ? new TextEncoder().encode(JSON.stringify(catalog)) : new Uint8Array([1, 2, 3]);
} } } };
const bundle = await build({ entryPoints: ['src/plugins/hyperDeck/libraryClient.ts'], bundle: true, format: 'esm', write: false, plugins: [{ name: 'storage-mock', setup(b) {
    b.onResolve({ filter: /^@api\/DataStore$/ }, () => ({ path: 'store', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export async function get(k){return globalThis.__musicCache.get(k)}; export async function set(k,v){globalThis.__musicCache.set(k,v)}' }));
} }] });
const { loadLibrary, downloadTrack } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('reopening library reuses listing and queues metadata without downloading music', async () => {
    const lists = await Promise.all([loadLibrary(), loadLibrary()]);
    await loadLibrary();
    assert.deepEqual(requests, ['catalog.json']);
    assert.equal(lists[0][0].sha, 'a'.repeat(40));
});
test('concurrent repeat loads download once; changed GitHub SHA invalidates cached file', async () => {
    const [track] = await loadLibrary();
    const files = await Promise.all([downloadTrack(track), downloadTrack(track)]);
    assert.equal(files[0].size, 3);
    assert.equal(requests.filter(x => x === 'song.mp3').length, 1);
    await downloadTrack({ ...track, sha: 'b'.repeat(40) });
    assert.equal(requests.filter(x => x === 'song.mp3').length, 2);
});
