import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rectangle } from '../src/plugins/hyperImagePrep/rect.ts';
import { validTrim } from '../src/plugins/hyperImagePrep/trim.ts';
test('video trims reject invalid, reversed, oversized and out-of-source ranges', () => {
    for (const values of [[NaN, 1, 5], [0, Infinity, 5], [0, 1, NaN], [-1, 2, 5], [4, 2, 5], [0, 6, 5], [0, 0.2, 5], [0, 301, 400]]) {
        assert.equal(validTrim(...values), false);
    }
    assert.equal(validTrim(0, 0.25, 0.25), true);
    assert.equal(validTrim(30, 330, 400), true);
});
test('selection cannot leave image bounds or accept invalid numeric input', () => {
    assert.deepEqual(rectangle({x:90,y:60,width:40,height:80},100,80),{x:90,y:60,width:10,height:20});
    assert.deepEqual(rectangle({x:NaN,y:-5,width:Infinity,height:-2},100,80),{x:0,y:0,width:0,height:0});
    assert.deepEqual(rectangle({x:110,y:90,width:20,height:20},100,80),{x:100,y:80,width:0,height:0});
});
