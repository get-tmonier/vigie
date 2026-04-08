import * as BunRuntime from '@effect/platform-bun/BunRuntime';
import { Effect } from 'effect';
import { cleanup } from '#modules/daemon/dependencies';
import { AppLive, runDaemon } from './dependencies';

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

BunRuntime.runMain(runDaemon.pipe(Effect.provide(AppLive)) as Effect.Effect<never, never, never>);
