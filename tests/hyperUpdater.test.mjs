import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/plugins/hyperUpdater/package.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { decodePackage, newerVersion } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = text => ({ base64: Buffer.from(text).toString('base64'), sha256: hash(text) });
const payload = () => ({ format: 1, minLoader: 1, version: '0.5.0', files: Object.fromEntries(['patcher.js', 'preload.js', 'renderer.js', 'renderer.css'].map(name => [name, file('content')])) });
function decode(data) { const bytes = Buffer.from(JSON.stringify(data)); return decodePackage(bytes, '0.5.0', hash(bytes)); }

test('stable version comparison rejects prereleases, equal and older versions', () => {
    assert.equal(newerVersion('0.5.0', '0.4.0'), true);
    for (const v of ['0.3.0', '0.4.0', '0.5.0-beta', 'garbage']) assert.equal(newerVersion(v, '0.4.0'), false);
});
test('package requires digest, complete files, compatible loader and safe paths', () => {
    assert.equal(Object.keys(decode(payload())).length, 4);
    const bytes = Buffer.from(JSON.stringify(payload()));
    assert.throws(() => decodePackage(bytes, '0.5.0', '0'.repeat(64)));
    let p = payload(); p.files['../settings/settings.json'] = file('bad'); assert.throws(() => decode(p));
    p = payload(); p.files['settings.json'] = file('bad'); assert.throws(() => decode(p));
    p = payload(); delete p.files['patcher.js']; assert.throws(() => decode(p));
    p = payload(); p.files['renderer.js'].sha256 = '0'.repeat(64); assert.throws(() => decode(p));
    p = payload(); p.minLoader = 2; assert.throws(() => decode(p));
});

const loader = fs.readFileSync('installer/bootstrap.cjs', 'utf8');
const old = '0.4.0-aaaaaaaaaaaa', next = '0.5.0-bbbbbbbbbbbb';
function fixture(fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hyperdc-loader-test-'));
    const stateFile = path.join(root, 'update-state.json');
    const settings = path.join(root, 'settings'); fs.mkdirSync(settings); fs.writeFileSync(path.join(settings, 'settings.json'), '{"keep":true}');
    const loaded = [];
    function run(throwNew = false) {
        vm.runInNewContext(loader, { __dirname: root, require: id => {
            if (id === 'fs') return fs;
            if (id === 'path') return path;
            if (id === 'electron') return { app: { relaunch() { loaded.push('relaunch'); }, exit() {} } };
            loaded.push(id);
            if (throwNew && id.includes(next)) throw Error('broken patcher');
        } });
    }
    try { fn({ root, stateFile, run, loaded }); assert.equal(fs.readFileSync(path.join(settings, 'settings.json'), 'utf8'), '{"keep":true}'); }
    finally { fs.rmSync(root, { recursive: true }); }
}
test('unconfirmed startup rolls back on next launch without touching settings', () => fixture(({ stateFile, run, loaded }) => {
    fs.writeFileSync(stateFile, JSON.stringify({ current: next, previous: old, pending: true, attempted: false }));
    run(); assert.ok(loaded[0].includes(next));
    assert.equal(JSON.parse(fs.readFileSync(stateFile)).attempted, true);
    run(); assert.ok(loaded[1].includes(old));
    const state = JSON.parse(fs.readFileSync(stateFile)); assert.equal(state.current, old); assert.equal(state.rolledBack, true);
}));
test('confirmed startup keeps new version and synchronous failure prepares rollback restart', () => fixture(({ stateFile, run, loaded }) => {
    fs.writeFileSync(stateFile, JSON.stringify({ current: next, previous: old, pending: false }));
    run(); run(); assert.ok(loaded.every(p => p.includes(next)));
    fs.writeFileSync(stateFile, JSON.stringify({ current: next, previous: old, pending: true }));
    run(true); assert.equal(JSON.parse(fs.readFileSync(stateFile)).current, old); assert.equal(loaded.at(-1), 'relaunch');
}));
