import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Where uploaded images live.
 *
 * The database stores a *key*, never a URL: the public prefix is configuration,
 * so moving from local disk to S3 later changes this file and nothing else.
 *
 * Names are random. A user never influences a path, so no upload can traverse
 * out of the directory or overwrite another person's file.
 */

const ROOT = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

export function buildKey(folder: 'avatars' | 'posts', extension = 'webp'): string {
  return `${folder}/${randomBytes(16).toString('hex')}.${extension}`;
}

export async function saveObject(key: string, data: Buffer): Promise<void> {
  const target = path.join(ROOT, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

/** Deleting is best-effort: a missing file must not fail the user's request. */
export async function deleteObject(key: string | null | undefined): Promise<void> {
  if (!key) return;

  try {
    await unlink(path.join(ROOT, key));
  } catch (error) {
    logger.warn({ key, err: error }, 'could not delete stored object');
  }
}

export function publicUrl(key: string): string {
  return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

/** Absolute path of the directory Express serves the images from. */
export function storageRoot(): string {
  return ROOT;
}

/**
 * The key inside a stored URL, or null when the URL points somewhere else.
 *
 * Users carry a URL, not a key, because that is what the app renders. Deleting
 * the old file after a replacement needs the key back — and a URL that does not
 * belong to this storage must never be turned into a path we would unlink.
 */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const prefix = `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/`;
  if (!url.startsWith(prefix)) return null;

  const key = url.slice(prefix.length);
  return /^(avatars|posts)\/[a-f0-9]{32}\.webp$/.test(key) ? key : null;
}
