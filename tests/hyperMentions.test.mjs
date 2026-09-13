import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMention, isDirectMention } from '../src/plugins/hyperQuiet/mentions.ts';

test('only explicit mentions of the current account, excluding self and optimistic messages', () => {
    const msg = { id: '123', author: { id: 'other' }, mentions: [{ id: 'me' }] };
    assert.equal(isDirectMention(msg, 'me'), true);
    assert.equal(isDirectMention({ ...msg, mentions: ['me'] }, 'me'), true);
    assert.equal(isDirectMention(msg, 'another-account'), false);
    assert.equal(isDirectMention(msg, 'me', true), false);
    assert.equal(isDirectMention({ ...msg, author: { id: 'me' } }, 'me'), false);
    assert.equal(isDirectMention({ ...msg, mentions: [], mention_everyone: true }, 'me'), false);
});
test('deduplicates gateway events and bounds retention without mutating previous rows', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: String(i), read: false }));
    assert.equal(addMention(rows, { id: '2' }), rows);
    const result = addMention(rows, { id: 'new', read: false });
    assert.equal(result.length, 200);
    assert.equal(result[0].id, 'new');
    assert.equal(result.at(-1).id, '198');
    assert.equal(rows[0].id, '0');
});
