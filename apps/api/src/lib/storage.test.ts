import { describe, expect, it } from 'vitest';

import { buildKey, keyFromUrl, publicUrl } from './storage.js';

describe('buildKey', () => {
  it('names files randomly, so no upload can collide with or overwrite another', () => {
    const keys = new Set(Array.from({ length: 200 }, () => buildKey('posts')));
    expect(keys.size).toBe(200);
  });

  it('puts each kind in its own folder', () => {
    expect(buildKey('avatars')).toMatch(/^avatars\/[a-f0-9]{32}\.webp$/);
    expect(buildKey('posts')).toMatch(/^posts\/[a-f0-9]{32}\.webp$/);
  });
});

describe('keyFromUrl', () => {
  it('recovers the key from a URL this storage produced', () => {
    const key = buildKey('avatars');
    expect(keyFromUrl(publicUrl(key))).toBe(key);
  });

  it('returns null for anything else', () => {
    for (const url of [null, undefined, '', 'https://evil.example.com/avatars/x.webp']) {
      expect(keyFromUrl(url)).toBeNull();
    }
  });

  it('refuses a path that tries to escape the storage folder', () => {
    // The key is turned into a filesystem path, so traversal here would mean
    // deleting files outside the upload directory.
    for (const key of [
      '../../.env',
      'avatars/../../../etc/passwd',
      'avatars/..%2f..%2f.env',
      'posts/x.webp/../../secret',
    ]) {
      expect(keyFromUrl(`${publicUrl('')}${key}`)).toBeNull();
    }
  });

  it('refuses a name that is not one this storage would have written', () => {
    expect(keyFromUrl(publicUrl('avatars/photo.webp'))).toBeNull();
    expect(keyFromUrl(publicUrl('avatars/00112233445566778899aabbccddeeff.php'))).toBeNull();
    expect(keyFromUrl(publicUrl('secrets/00112233445566778899aabbccddeeff.webp'))).toBeNull();
  });
});
