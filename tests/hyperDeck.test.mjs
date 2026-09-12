import assert from 'node:assert/strict';
import { test } from 'node:test';

class Node {
    gain = { value: 1 };
    connect() { return this; }
    disconnect() {}
}
let microphoneStopped = 0;
const stream = () => ({ getTracks: () => [{ stop() { microphoneStopped++; } }] });
class AudioMock {
    paused = true;
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    setSinkId(id) { this.sinkId = id; return Promise.resolve(); }
    load() {}
    removeAttribute() {}
}
globalThis.Audio = AudioMock;
globalThis.AudioContext = class {
    destination = new Node();
    createAnalyser() { return new Node(); }
    createGain() { return new Node(); }
    createMediaStreamDestination() { return Object.assign(new Node(), { stream: stream() }); }
    createMediaElementSource() { return new Node(); }
    createMediaStreamSource() { return new Node(); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
};
const devices = [
    { kind: 'audiooutput', deviceId: 'cable', label: 'CABLE Input (VB-Audio Virtual Cable)' },
    { kind: 'audiooutput', deviceId: 'speaker', label: 'Speakers' },
    { kind: 'audioinput', deviceId: 'mic', label: 'USB Microphone' },
    { kind: 'audioinput', deviceId: 'loop', label: 'CABLE Output' }
];
let getMic = async () => stream();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    enumerateDevices: async () => devices,
    getUserMedia: () => getMic()
} } });
const { DeckAudio } = await import('../src/plugins/hyperDeck/audio.ts');

test('sending is off initially and refuses disconnected or physical outputs', async () => {
    const d = new DeckAudio();
    assert.equal(d.send.gain.value, 0);
    await assert.rejects(d.enableSend('cable', '', () => false));
    await assert.rejects(d.enableSend('speaker', '', () => true));
    assert.equal(d.send.gain.value, 0);
    d.dispose();
});
test('routes only to selected virtual output and releases microphone on stop', async () => {
    const d = new DeckAudio();
    assert.equal(await d.enableSend('cable', 'mic', () => true), true);
    assert.equal(d.output.sinkId, 'cable');
    assert.equal(d.send.gain.value, 1);
    const before = microphoneStopped;
    d.disableSend();
    assert.equal(d.send.gain.value, 0);
    assert.equal(d.output.paused, true);
    assert.equal(microphoneStopped, before + 1);
    d.dispose();
});
test('rejects virtual microphone loopback', async () => {
    const d = new DeckAudio();
    await assert.rejects(d.enableSend('cable', 'loop', () => true));
    assert.equal(d.send.gain.value, 0);
    d.dispose();
});
test('closing while microphone permission is pending cannot start transmission', async () => {
    const d = new DeckAudio();
    let resolveMic;
    getMic = () => new Promise(resolve => { resolveMic = resolve; });
    const pending = d.enableSend('cable', 'mic', () => true);
    while (!resolveMic) await new Promise(resolve => setImmediate(resolve));
    d.dispose();
    const before = microphoneStopped;
    resolveMic(stream());
    assert.equal(await pending, false);
    assert.equal(microphoneStopped, before + 1);
    assert.equal(d.send.gain.value, 0);
    getMic = async () => stream();
});
test('a channel change during output selection cancels transmission', async () => {
    const d = new DeckAudio();
    let allowed = true;
    d.output.setSinkId = async () => { allowed = false; };
    assert.equal(await d.enableSend('cable', '', () => allowed), false);
    assert.equal(d.send.gain.value, 0);
    d.dispose();
});
test('file validation preserves current playback on an invalid selection', () => {
    const d = new DeckAudio();
    assert.throws(() => d.load(new File(['abc'], 'a.wav')));
    assert.throws(() => d.load(new File([], 'a.mp3')));
    assert.equal(d.audio.src, undefined);
    d.load(new File(['abc'], 'a.mp3'));
    assert.match(d.audio.src, /^blob:/);
    d.dispose();
});
