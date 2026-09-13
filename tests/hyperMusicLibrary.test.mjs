import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryUrl, MAX_TRACK_BYTES, readLimited, validateLibrary } from '../src/plugins/hyperDeck/library.ts';

test('new GitHub MP3 files appear without a manifest, including Turkish filenames', () => {
    const items = [{ type: 'file', name: 'Yeni Şarkı.mp3', size: 123 }, { type: 'dir', name: 'folder.mp3', size: 10 }, { type: 'file', name: 'README.md', size: 10 }];
    assert.deepEqual(validateLibrary(items), [{ title: 'Yeni Şarkı', file: 'Yeni Şarkı.mp3', bytes: 123 }]);
    assert.ok(libraryUrl(items[0].name).endsWith('Yeni%20%C5%9Eark%C4%B1.mp3'));
});
test('rejects paths and excludes oversized or empty tracks', () => {
    for (const file of ['../x.mp3', 'x/y.mp3', 'x\\y.mp3', 'https://evil.test/x.mp3']) assert.throws(() => libraryUrl(file));
    assert.deepEqual(validateLibrary([{ type: 'file', name: 'large.mp3', size: MAX_TRACK_BYTES + 1 }, { type: 'file', name: 'empty.mp3', size: 0 }]), []);
    assert.throws(() => validateLibrary({ message: 'API rate limit' }));
});
test('download enforces response and streaming size bounds', async () => {
    await assert.rejects(readLimited(new Response('missing', { status: 404 }), 20));
    await assert.rejects(readLimited(new Response(new Uint8Array(11)), 10));
    assert.equal((await readLimited(new Response(new Uint8Array(10)), 10)).length, 10);
});
