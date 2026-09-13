import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const original = { input: 'physical', mode: 'PUSH_TO_TALK', options: { autoThreshold: true, threshold: -60, vadUseKrisp: true, delay: 30 }, cancellation: true, suppression: false, echo: true, gain: true };
const inputs = { virtual: { id: 'discord-cable-id', index: 1, name: 'CABLE Output (VB-Audio Virtual Cable)', disabled: false } };
let state, writes, fail;
const saved = new Map();
const actions = Object.fromEntries(Object.entries({ setInputDevice: 'input', setNoiseCancellation: 'cancellation', setNoiseSuppression: 'suppression', setEchoCancellation: 'echo', setAutomaticGainControl: 'gain' }).map(([method, field]) => [method, value => {
    writes++;
    if (fail === method) { fail = undefined; throw Error('device failure'); }
    state[field] = value;
    if (method === 'setNoiseCancellation') state.suppression = !value;
}]));
actions.setMode = (mode, options) => { writes++; state.mode = mode; state.options = structuredClone(options); };
const store = Object.fromEntries(Object.entries({ getInputDeviceId: 'input', getMode: 'mode', getModeOptions: 'options', getNoiseCancellation: 'cancellation', getNoiseSuppression: 'suppression', getEchoCancellation: 'echo', getAutomaticGainControl: 'gain' }).map(([method, field]) => [method, () => state[field]]));
store.getInputDevices = () => inputs;
globalThis.voiceSetupTest = { store, actions, saved };
const bundle = await build({ entryPoints: ['src/plugins/hyperDeck/voiceSetup.ts'], bundle: true, write: false, format: 'esm', plugins: [{ name: 'voice-adapters', setup(b) {
    b.onResolve({ filter: /^@/ }, args => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === '@api/DataStore'
        ? 'export const get=async k=>globalThis.voiceSetupTest.saved.get(k); export const set=async(k,v)=>globalThis.voiceSetupTest.saved.set(k,structuredClone(v)); export const del=async k=>globalThis.voiceSetupTest.saved.delete(k);'
        : args.path === '@webpack/common' ? 'export const MediaEngineStore=globalThis.voiceSetupTest.store;'
        : args.path === '@webpack' ? 'export const findByPropsLazy=()=>globalThis.voiceSetupTest.actions;'
        : 'export const hyperTranslate=s=>s;' }));
} }] });
const setup = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const output = { kind: 'audiooutput', deviceId: 'browser-cable-id', label: 'CABLE Input (VB-Audio Virtual Cable)' };
function reset() { state = structuredClone(original); writes = 0; fail = undefined; saved.clear(); }

test('missing or ambiguous cable makes no changes', async () => {
    reset();
    await assert.rejects(setup.applyVoiceSetup([], ''));
    await assert.rejects(setup.applyVoiceSetup([output, { ...output, deviceId: 'other' }], ''));
    assert.equal(writes, 0);
    assert.equal(saved.size, 0);
});
test('uses Discord input ID, disables processing and preserves original backup on repeated apply', async () => {
    reset();
    assert.equal(await setup.applyVoiceSetup([output], ''), output.deviceId);
    assert.equal(state.input, 'discord-cable-id');
    assert.equal(state.mode, 'VOICE_ACTIVITY');
    assert.equal(state.options.threshold, -100);
    assert.equal(state.options.vadUseKrisp, false);
    for (const field of ['cancellation', 'suppression', 'echo', 'gain']) assert.equal(state[field], false);
    await setup.applyVoiceSetup([output], output.deviceId);
    await setup.restoreVoiceSetup();
    assert.deepEqual(state, original);
    assert.equal(saved.size, 0);
});
test('partial failure restores all previous settings', async () => {
    reset(); fail = 'setEchoCancellation';
    await assert.rejects(setup.applyVoiceSetup([output], ''), /device failure/);
    assert.deepEqual(state, original);
    assert.equal(saved.size, 0);
});
