import { existsSync, readFileSync } from 'node:fs';
import { Effect } from 'effect';
import { DEFAULT_PORT, PORT_FILE } from '../paths';

export function openCommand(): Effect.Effect<void> {
  return Effect.sync(() => {
    let port = DEFAULT_PORT;

    if (existsSync(PORT_FILE)) {
      const stored = readFileSync(PORT_FILE, 'utf-8').trim();
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed)) {
        port = parsed;
      }
    }

    const url = `http://localhost:${port}`;
    const platform = process.platform;

    if (platform === 'darwin') {
      Bun.spawn(['open', url]);
    } else if (platform === 'linux') {
      Bun.spawn(['xdg-open', url]);
    } else if (platform === 'win32') {
      Bun.spawn(['cmd', '/c', 'start', url]);
    } else {
      console.log(`Open ${url} in your browser`);
      return;
    }

    console.log(`Opening ${url}`);
  });
}
