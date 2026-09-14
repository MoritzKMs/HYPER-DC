import assert from 'node:assert/strict';
import { test } from 'node:test';
import { floatingPreviewGetter, previewGetter } from '../src/plugins/hyperLivePreview/patch.ts';

// Getter from the locally inspected Discord client bundle.
const original = 'get pauseSelfStreamPreviewWhenUnfocused(){return A.pauseSelfStreamPreviewWhenUnfocused??!0}';
// Floating call player getter from the installed Discord client's cached bundle.
const floating = 'get streamerPaused(){let{isMainWindowFocused:e,activeSelfStream:t,participantOnScreen:n}=this.props;return null!=t&&n?.id===(0,L._z)(t)&&!e}';
test('floating self-preview continues when unfocused without changing actual stream state', () => {
    const source = 'return class {' + floating + ' get videoPaused(){return this.streamerPaused} get actualState(){return this.props.activeSelfStream?.state}}';
    const Patched = new Function('L', source.replace(floatingPreviewGetter, 'get streamerPaused(){return false}'))({_z: stream => stream.id});
    const Original = new Function('L', source)({_z: stream => stream.id});
    for (const focused of [true, false]) for (const self of [true, false]) for (const state of ['LIVE', 'PAUSED', 'RECONNECTING', 'ENDED']) {
        const props = {isMainWindowFocused: focused, activeSelfStream: {id:'self',state}, participantOnScreen:{id:self?'self':'remote'}};
        const before = new Original(); before.props = props;
        assert.equal(before.videoPaused, self && !focused);
        const after = new Patched(); after.props = props;
        assert.equal(after.videoPaused, false);
        assert.equal(after.actualState, state);
        assert.equal(props.isMainWindowFocused, focused);
    }
    const empty = new Patched(); empty.props = {};
    assert.equal(empty.videoPaused, false);
});
test('floating preview matcher handles renamed identifiers but rejects different pause logic', () => {
    assert.equal(floatingPreviewGetter.test(floating), true);
    assert.equal(floatingPreviewGetter.test(floating.replaceAll(':e', ':focused').replace('&&!e', '&&!focused')), true);
    assert.equal(floatingPreviewGetter.test(floating.replace('&&!e', '||!e')), false);
    assert.equal(floatingPreviewGetter.test(floating.replace('isMainWindowFocused', 'isVideoEnabled')), false);
});
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
