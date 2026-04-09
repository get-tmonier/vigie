import * as BunRuntime from '@effect/platform-bun/BunRuntime';
import { Effect } from 'effect';
import { AppLive, runDaemon } from '#dependencies';
import { cleanup } from '#shell/dependencies';
import { getDefaultDaemonConfig } from '#shell/infrastructure/daemon-config';

process.on('SIGTERM', () => {
  process.stdout.write('[daemon] Stopped.\n');
  cleanup(getDefaultDaemonConfig());
  process.exit(0);
});
process.on('SIGINT', () => {
  process.stdout.write('[daemon] Stopped.\n');
  cleanup(getDefaultDaemonConfig());
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  Effect.runFork(Effect.logError('[daemon] Uncaught exception:', err));
  cleanup(getDefaultDaemonConfig());
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  Effect.runFork(Effect.logError('[daemon] Unhandled rejection:', reason));
  cleanup(getDefaultDaemonConfig());
  process.exit(1);
});

BunRuntime.runMain(runDaemon.pipe(Effect.provide(AppLive)) as Effect.Effect<never, never, never>);
