import { afterAll, describe, expect, it } from 'bun:test';
import { rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearCredentials, getCredentials, saveCredentials } from '../modules/auth/credentials.js';

const TEST_DIR = join(tmpdir(), `tmonier-test-${Date.now()}`);

afterAll(() => {
  try {
    rmSync(TEST_DIR, { recursive: true });
  } catch {}
});

describe('credentials', () => {
  it('returns null when no credentials exist', async () => {
    const result = await getCredentials(join(TEST_DIR, 'nonexistent'));
    expect(result).toBeNull();
  });

  it('saves and reads credentials', async () => {
    const dir = join(TEST_DIR, 'save-test');
    await saveCredentials('tmonier_testkey', undefined, dir);

    const result = await getCredentials(dir);
    expect(result).toBeDefined();
    expect(result?.token).toBe('tmonier_testkey');
  });

  it('saves with apiUrl', async () => {
    const dir = join(TEST_DIR, 'api-url-test');
    await saveCredentials('tmonier_testkey', 'ws://custom:3001', dir);

    const result = await getCredentials(dir);
    expect(result?.apiUrl).toBe('ws://custom:3001');
  });

  it('creates directory with 0o700 permissions', async () => {
    const dir = join(TEST_DIR, 'perms-test');
    await saveCredentials('tmonier_testkey', undefined, dir);

    const stats = statSync(dir);
    expect(stats.mode & 0o777).toBe(0o700);
  });

  it('creates file with 0o600 permissions', async () => {
    const dir = join(TEST_DIR, 'file-perms-test');
    await saveCredentials('tmonier_testkey', undefined, dir);

    const stats = statSync(join(dir, 'credentials.json'));
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it('clears credentials', async () => {
    const dir = join(TEST_DIR, 'clear-test');
    await saveCredentials('tmonier_testkey', undefined, dir);
    expect(await getCredentials(dir)).not.toBeNull();

    await clearCredentials(dir);
    expect(await getCredentials(dir)).toBeNull();
  });

  it('clear does not throw when file missing', async () => {
    await clearCredentials(join(TEST_DIR, 'missing'));
  });
});
