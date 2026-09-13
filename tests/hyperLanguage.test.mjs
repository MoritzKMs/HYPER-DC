import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/utils/hyperLanguage/index.ts'], bundle: true, format: 'esm', write: false });
let serial = 0;
async function language(value) {
    const settings = { plugins: { HyperDCLanguage: { language: value }, HyperQuiet: { enabled: true, mode: 1 }, HyperDeck: { enabled: true } } };
    const before = structuredClone(settings);
    globalThis.VencordNative = { settings: { get: () => settings } };
    const module = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text + `\n// instance ${serial++}`).toString('base64'));
    assert.deepEqual(settings, before);
    return module.hyperTranslate;
}
test('Turkish translates UI and preserves unknown strings and format tokens', async () => {
    const t = await language('tr');
    assert.equal(t('Plugins'), 'Eklentiler');
    assert.equal(t('Buy Vencord a coffee'), 'Vencord’a kahve ısmarla');
    assert.equal(t('Apply voice transmission settings'), 'Ses aktarımı için ayarları uygula');
    assert.equal(t('UnknownPluginId'), 'UnknownPluginId');
    assert.ok(t('What text the hyperlink should use. {{NAME}} will be replaced with the emoji/sticker name.').includes('{{NAME}}'));
});
test('English keeps original UI and unsupported language falls back to Turkish', async () => {
    const en = await language('en');
    assert.equal(en('Plugins'), 'Plugins');
    assert.equal(en('Apply voice transmission settings'), 'Apply voice transmission settings');
    assert.equal((await language(undefined))('Plugins'), 'Eklentiler');
});
