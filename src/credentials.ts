import { chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as v from 'valibot';

const CredentialsSchema = v.object({
  token: v.string(),
  apiUrl: v.optional(v.string()),
});

type Credentials = v.InferOutput<typeof CredentialsSchema>;

const DEFAULT_DIR = join(homedir(), '.tmonier');

function paths(dir: string) {
  return { dir, file: join(dir, 'credentials.json') };
}

export async function getCredentials(dir = DEFAULT_DIR): Promise<Credentials | null> {
  const { file } = paths(dir);
  const f = Bun.file(file);
  if (!(await f.exists())) return null;
  try {
    const result = v.safeParse(CredentialsSchema, await f.json());
    return result.success ? result.output : null;
  } catch {
    return null;
  }
}

export async function saveCredentials(
  token: string,
  apiUrl?: string,
  dir = DEFAULT_DIR
): Promise<void> {
  const { mkdirSync } = await import('node:fs');
  const p = paths(dir);
  mkdirSync(p.dir, { recursive: true, mode: 0o700 });

  const data: Credentials = { token };
  if (apiUrl) data.apiUrl = apiUrl;
  await Bun.write(p.file, JSON.stringify(data, null, 2));
  chmodSync(p.file, 0o600);
}

export async function clearCredentials(dir = DEFAULT_DIR): Promise<void> {
  const { unlinkSync } = await import('node:fs');
  const { file } = paths(dir);
  try {
    unlinkSync(file);
  } catch {
    // file may not exist
  }
}
