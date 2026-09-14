import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMonitorOutput, VoiceMonitor } from '../src/plugins/hyperVoice/monitor.ts';

const devices = [
    { kind: 'audiooutput', deviceId: 'headphones', label: 'USB Headphones' },
    { kind: 'audiooutput', deviceId: 'cable', label: 'CABLE Input' },
    { kind: 'audiooutput', deviceId: 'default', label: 'Default Headphones' }
];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { enumerateDevices: async () => devices } } });
let sinkWait = async () => {};
let instances = [];
globalThis.Audio = class {
    constructor() { instances.push(this); }
    paused = true;
    async setSinkId(id) { this.sinkId = id; await sinkWait(); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
};
test('monitor refuses virtual outputs and automatic devices', async () => {
    assert.deepEqual(devices.filter(isMonitorOutput).map(d => d.deviceId), ['headphones']);
    const monitor = new VoiceMonitor();
    await assert.rejects(monitor.start({}, 'cable', .3));
    await assert.rejects(monitor.start({}, 'default', .3));
});
test('monitor uses independent volume and releases playback without stopping shared source', async () => {
    const monitor = new VoiceMonitor();
    const source = {};
    assert.equal(await monitor.start(source, 'headphones', .35), true);
    const audio = instances.at(-1);
    assert.equal(audio.srcObject, source);
    assert.equal(audio.volume, .35);
    monitor.setVolume(4); assert.equal(audio.volume, 1);
    monitor.stop(); assert.equal(audio.paused, true); assert.equal(audio.srcObject, null);
});
test('stopping during output selection cannot restart monitoring', async () => {
    let resume;
    sinkWait = () => new Promise(resolve => { resume = resolve; });
    const monitor = new VoiceMonitor();
    const pending = monitor.start({}, 'headphones', .5);
    await new Promise(resolve => setImmediate(resolve));
    monitor.stop(); resume();
    assert.equal(await pending, false);
    assert.equal(instances.at(-1).paused, true);
    assert.equal(instances.at(-1).srcObject, null);
    sinkWait = async () => {};
});
