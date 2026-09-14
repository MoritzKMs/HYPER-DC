import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alarmReady, clipping } from '../src/plugins/hyperExtras/core.ts';

test('person alarm only fires on entry, not unrelated changes or a person already present', () => {
    assert.equal(alarmReady(['a'], ['a', 'b'], 'b', 5), true);
    assert.equal(alarmReady(['a', 'b'], ['b'], 'b', 5), false);
    assert.equal(alarmReady(['a'], ['a', 'c'], 'b', 5), false);
});
test('capacity alarm only fires when a full limited channel gains room', () => {
    assert.equal(alarmReady(['a', 'b'], ['b'], '', 2), true);
    assert.equal(alarmReady(['a'], [], '', 2), false);
    assert.equal(alarmReady(['a'], [], '', 0), false);
    assert.equal(alarmReady(['a', 'b'], ['a', 'c'], '', 2), false);
});
test('peak detection accepts both polarities but ignores silence and isolated transients', () => {
    assert.equal(clipping(new Float32Array(2048)), false);
    const samples = new Float32Array(2048); samples[0] = 1;
    assert.equal(clipping(samples), false);
    samples.fill(-0.99, 0, 20); assert.equal(clipping(samples), true);
    samples.fill(0.75); assert.equal(clipping(samples), false);
});
