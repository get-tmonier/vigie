import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as BunRuntime from '@effect/platform-bun/BunRuntime';
import { Effect } from 'effect';
import { AppLayer, runDaemon } from './dependencies';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

function cleanup() {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try {
      unlinkSync(join(_HOME, file));
    } catch {}
  }
}

process.on('SIGTERM', () => {
  process.stdout.write('[daemon] Stopped.\n');
  cleanup();
  process.exit(0);
});
process.on('SIGINT', () => {
  process.stdout.write('[daemon] Stopped.\n');
  cleanup();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  Effect.runFork(Effect.logError('[daemon] Uncaught exception:', err));
  cleanup();
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  Effect.runFork(Effect.logError('[daemon] Unhandled rejection:', reason));
  cleanup();
  process.exit(1);
});

BunRuntime.runMain(runDaemon.pipe(Effect.provide(AppLayer)));
