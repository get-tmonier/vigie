import { existsSync, readFileSync } from 'node:fs';
import { Console, Effect } from 'effect';
import { DaemonConfig } from '#shell/infrastructure/daemon-config';

export function openCommand() {
  return Effect.gen(function* () {
    const { port: defaultPort, portFile } = yield* DaemonConfig;

    let port = defaultPort;

    if (existsSync(portFile)) {
      const stored = readFileSync(portFile, 'utf-8').trim();
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
      yield* Console.log(`Open ${url} in your browser`);
      return;
    }

    yield* Console.log(`Opening ${url}`);
  });
}
