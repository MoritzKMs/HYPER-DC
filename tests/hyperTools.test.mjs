import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pauseCountdown, remainingTime, resumeCountdown, validateItems } from '../src/utils/hyperTools/core.ts';

const bundle = await build({ entryPoints: ['src/utils/hyperTools/storage.ts'], bundle: true, format: 'esm', write: false });
const { createPersonalStorage } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('concurrent saves are serialized, survive reload and isolate account keys', async () => {
    const data = new Map();
    const database = { get: async key => structuredClone(data.get(key)), set: async (key, rows) => { data.set(key, structuredClone(rows)); } };
    const storage = createPersonalStorage(database);
    const item = id => ({ id, channelId: '123', text: id, done: false });
    await Promise.all([
        storage.update('user-a', () => true, rows => [...rows, item('1')]),
        storage.update('user-a', () => true, rows => [...rows, item('2')]),
        storage.update('user-b', () => true, rows => [...rows, item('3')])
    ]);
    const reloaded = createPersonalStorage(database);
    await reloaded.update('user-a', () => true, rows => rows.map(row => row.id === '1' ? { ...row, done: true } : row));
    assert.deepEqual(data.get('user-a'), [{ ...item('1'), done: true }, item('2')]);
    assert.deepEqual(data.get('user-b'), [item('3')]);
});

test('account switches during an awaited read prevent writes', async () => {
    let active = true;
    let writes = 0;
    const storage = createPersonalStorage({ get: async () => { active = false; return []; }, set: async () => { writes++; } });
    assert.equal(await storage.update('old-account', () => active, rows => rows), false);
    assert.equal(writes, 0);
});

test('disk failure keeps previous data and does not poison subsequent saves', async () => {
    const original = [{ id: '1', channelId: '123', text: 'Notum', done: false }];
    let saved = original;
    let fail = true;
    const storage = createPersonalStorage({ get: async () => structuredClone(saved), set: async (_, value) => {
        if (fail) throw new Error('disk failure');
        saved = value;
    } });
    await assert.rejects(storage.update('account', () => true, () => []), /disk failure/);
    assert.deepEqual(saved, original);
    fail = false;
    assert.equal(await storage.update('account', () => true, () => []), true);
    assert.deepEqual(saved, []);
});

test('corrupt records and invalid channel routes cannot enter personal storage', () => {
    const valid = { id: 'task-1', channelId: '123456789', text: 'Bir işi tamamla', done: false };
    const bookmark = { ...valid, id: 'bookmark', messageId: '987654321', guildId: '1234' };
    const input = [valid, valid, bookmark, null, {}, { ...valid, id: 'a', channelId: '../@me' },
        { ...valid, id: 'b', messageId: 42 }, { ...valid, id: 'c', guildId: '../../' },
        { ...valid, id: 'd', text: 'a'.repeat(1001) }, { ...valid, id: 'e', done: 'false' }];
    assert.deepEqual(validateItems(input), [valid, bookmark]);
    assert.equal(input.length, 10);
    assert.deepEqual(validateItems(null), []);
    assert.equal(validateItems(Array.from({ length: 600 }, (_, i) => ({ ...valid, id: String(i) }))).length, 500);
});

test('deadline-based timer handles throttled callbacks and computer sleep', () => {
    const timer = resumeCountdown({ remaining: 25 * 60000, deadline: null }, 10000);
    assert.equal(remainingTime(timer, 10000 + 10 * 60000), 15 * 60000);
    assert.equal(remainingTime(timer, 10000 + 90 * 60000), 0);
    assert.deepEqual(resumeCountdown(timer, 30000), timer);
});

test('paused time does not elapse and resuming preserves the exact remainder', () => {
    const running = resumeCountdown({ remaining: 60000, deadline: null }, 1000);
    const paused = pauseCountdown(running, 21000);
    assert.equal(remainingTime(paused, 999999), 40000);
    const resumed = resumeCountdown(paused, 1000000);
    assert.equal(remainingTime(resumed, 1015000), 25000);
    assert.equal(remainingTime(resumed, 1040000), 0);
    assert.deepEqual(pauseCountdown(resumed, 2000000), { remaining: 0, deadline: null });
});
