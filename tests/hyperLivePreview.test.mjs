import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previewGetter } from '../src/plugins/hyperLivePreview/patch.ts';

// Getter from the locally inspected Discord client bundle.
const original = 'get pauseSelfStreamPreviewWhenUnfocused(){return A.pauseSelfStreamPreviewWhenUnfocused??!0}';
test('disables only preview pausing for every stored preference value', () => {
    const source = 'return new class {get isFocused(){return false}' + original + '}';
    assert.equal([...source.matchAll(new RegExp(previewGetter, 'g'))].length, 1);
    const patched = source.replace(previewGetter, 'get pauseSelfStreamPreviewWhenUnfocused(){return false}');
    for (const preference of [undefined, true, false]) {
        const settings = { pauseSelfStreamPreviewWhenUnfocused: preference };
        const store = new Function('A', patched)(settings);
        assert.equal(store.pauseSelfStreamPreviewWhenUnfocused, false);
        assert.equal(store.isFocused, false);
        assert.equal(settings.pauseSelfStreamPreviewWhenUnfocused, preference);
    }
    assert.equal(new Function('A', source)({}).pauseSelfStreamPreviewWhenUnfocused, true);
});
test('does not modify unrelated getters or silently accept changed semantics', () => {
    for (const text of ['get isFocused(){return A.isFocused??!0}', 'get pauseSelfStreamPreviewWhenUnfocused(){return A.otherFlag??!0}']) {
        assert.equal(previewGetter.test(text), false);
    }
});
