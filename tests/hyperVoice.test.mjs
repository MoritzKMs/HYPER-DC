import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { processorSource } from '../src/plugins/hyperVoice/dsp.ts';
import { claimHyperMicrophone, releaseHyperMicrophone } from '../src/utils/hyperMicrophone.ts';

function render(mode, frequency = 440) {
    let Processor;
    vm.runInNewContext(processorSource, { AudioWorkletProcessor: class { port = {}; }, Float32Array, Math, sampleRate: 48000, registerProcessor: (_, p) => { Processor = p; } });
    const processor = new Processor(); processor.port.onmessage({ data: mode });
    const result = new Float32Array(96000);
    for (let offset = 0; offset < result.length; offset += 128) {
        const input = Float32Array.from({ length: 128 }, (_, i) => Math.sin(2 * Math.PI * frequency * (offset + i) / 48000) * 0.5);
        const output = new Float32Array(128);
        assert.equal(processor.process([[input]], [[output]]), true);
        result.set(output.subarray(0, Math.min(128, result.length - offset)), offset);
    }
    return result.subarray(48000);
}
function power(signal, frequency) {
    let re = 0, im = 0;
    for (let i = 0; i < signal.length; i++) { re += signal[i] * Math.cos(2 * Math.PI * frequency * i / 48000); im += signal[i] * Math.sin(2 * Math.PI * frequency * i / 48000); }
    return re * re + im * im;
}
test('normal preserves voice while robot adds the expected modulation sidebands', () => {
    const normal = render('normal');
    assert.ok(power(normal, 440) > power(normal, 395) * 100);
    const robot = render('robot');
    assert.ok(power(robot, 395) > power(robot, 440) * 100);
    assert.ok(power(robot, 485) > power(robot, 440) * 100);
});
test('higher and lower presets shift energy into the intended pitch range without clipping', () => {
    for (const [mode, range] of [['bright', [540, 630]], ['deep', [280, 370]]]) {
        const signal = render(mode);
        let maximum = 0;
        for (let f = range[0]; f <= range[1]; f++) maximum = Math.max(maximum, power(signal, f));
        assert.ok(maximum > power(signal, 440) * 10, mode);
        assert.ok(signal.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1));
    }
});

test('additional effects produce distinct, finite audio', () => {
    const normal = render('normal');
    for (const mode of ['chipmunk', 'monster', 'alien', 'radio', 'echo']) {
        const signal = render(mode);
        assert.ok(signal.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1), mode);
        let difference = 0, energy = 0;
        for (let i = 0; i < signal.length; i++) { difference += Math.abs(signal[i] - normal[i]); energy += signal[i] ** 2; }
        assert.ok(difference > 100 && energy > 1, mode);
    }
});
test('microphone mixing and voice effects cannot capture concurrently', () => {
    const deck = {}, voice = {};
    claimHyperMicrophone(deck);
    assert.throws(() => claimHyperMicrophone(voice));
    releaseHyperMicrophone(deck);
    claimHyperMicrophone(voice);
    releaseHyperMicrophone(voice);
});

test('account-panel insertion works with the existing game-activity button', () => {
    const original = 'children:[(0,i.jsx)(rf,{accountContainerRef:N,selfMute:n})]';
    const gamePatched = original.replace('children:[', 'children:[gameButton(arguments[0]),');
    const pattern = /(\(0,[\w$]+\.jsx\)\([\w$]+,\{accountContainerRef:)/;
    for (const source of [original, gamePatched]) {
        const result = source.replace(pattern, 'voiceButton(arguments[0]),$1');
        assert.equal((result.match(/voiceButton/g) || []).length, 1);
        assert.ok(result.indexOf('voiceButton') < result.indexOf('accountContainerRef'));
    }
});
