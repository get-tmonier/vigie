import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearCredentials, getCredentials, saveCredentials } from '../credentials.js';

const tmp = mkdtempSync(join(tmpdir(), 'tmonier-creds-'));

afterAll(async () => {
  const { rmSync } = await import('node:fs');
  rmSync(tmp, { recursive: true, force: true });
});

describe('getCredentials', () => {
  it('returns null when file is missing', async () => {
    const dir = join(tmp, 'empty');
    expect(await getCredentials(dir)).toBeNull();
  });

  it('parses valid JSON with token', async () => {
    const dir = join(tmp, 'valid');
    await saveCredentials('tmonier_abc', undefined, dir);
    const creds = await getCredentials(dir);
    expect(creds).toEqual({ token: 'tmonier_abc' });
  });

  it('includes apiUrl when present', async () => {
    const dir = join(tmp, 'with-api');
    await saveCredentials('tmonier_abc', 'https://api.example.com', dir);
    const creds = await getCredentials(dir);
    expect(creds).toEqual({ token: 'tmonier_abc', apiUrl: 'https://api.example.com' });
  });

  it('returns null on malformed JSON', async () => {
    const dir = join(tmp, 'malformed');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    await Bun.write(join(dir, 'credentials.json'), 'not json{{{');
    expect(await getCredentials(dir)).toBeNull();
  });

  it('returns null when token field is missing', async () => {
    const dir = join(tmp, 'no-token');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    await Bun.write(join(dir, 'credentials.json'), JSON.stringify({ foo: 'bar' }));
    expect(await getCredentials(dir)).toBeNull();
  });
});

describe('saveCredentials', () => {
  it('creates directory with 0o700 permissions', async () => {
    const dir = join(tmp, 'perms-dir');
    await saveCredentials('tmonier_x', undefined, dir);
    const stat = statSync(dir);
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it('writes file with 0o600 permissions', async () => {
    const dir = join(tmp, 'perms-file');
    await saveCredentials('tmonier_x', undefined, dir);
    const stat = statSync(join(dir, 'credentials.json'));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('writes correct JSON (token only)', async () => {
    const dir = join(tmp, 'json-token');
    await saveCredentials('tmonier_tok', undefined, dir);
    const content = JSON.parse(readFileSync(join(dir, 'credentials.json'), 'utf-8'));
    expect(content).toEqual({ token: 'tmonier_tok' });
  });

  it('writes correct JSON (with apiUrl)', async () => {
    const dir = join(tmp, 'json-api');
    await saveCredentials('tmonier_tok', 'https://api.test', dir);
    const content = JSON.parse(readFileSync(join(dir, 'credentials.json'), 'utf-8'));
    expect(content).toEqual({ token: 'tmonier_tok', apiUrl: 'https://api.test' });
  });

  it('overwrites existing file', async () => {
    const dir = join(tmp, 'overwrite');
    await saveCredentials('tmonier_old', undefined, dir);
    await saveCredentials('tmonier_new', undefined, dir);
    const content = JSON.parse(readFileSync(join(dir, 'credentials.json'), 'utf-8'));
    expect(content.token).toBe('tmonier_new');
  });
});

describe('clearCredentials', () => {
  it('removes the credentials file', async () => {
    const dir = join(tmp, 'clear');
    await saveCredentials('tmonier_x', undefined, dir);
    await clearCredentials(dir);
    expect(await getCredentials(dir)).toBeNull();
  });

  it('does not throw when file is missing', async () => {
    const dir = join(tmp, 'clear-missing');
    expect(async () => clearCredentials(dir)).not.toThrow();
  });
});
