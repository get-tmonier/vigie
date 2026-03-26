import { Console, Effect } from 'effect';
import { createBunProcessManager } from '../adapters/bun-process-manager.adapter.js';
import { runDaemon } from '../main.js';
import { LOG_FILE } from '../paths.js';

const manager = createBunProcessManager();

const exit0 = Effect.ensuring(Effect.sync(() => process.exit(0)));

function formatUptime(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function daemonStartCommand(foreground: boolean): Effect.Effect<void> {
  if (foreground) {
    return Effect.gen(function* () {
      const running = yield* manager.isRunning();
      if (running) {
        const info = yield* manager.status();
        yield* Console.log(
          `Daemon already running (pid ${info.pid}). Use \`vigie daemon attach\` to follow its logs.`
        );
        return;
      }
      yield* Console.log('Starting daemon in foreground...');
      yield* runDaemon;
    }).pipe(Effect.catchTag('DaemonNotRunningError', () => Effect.void));
  }

  return Effect.gen(function* () {
    yield* Console.log('Starting vigie daemon...');
    const info = yield* manager.start();
    yield* Console.log(`Daemon started (pid ${info.pid})`);
    yield* Console.log(`Socket: ${info.socketPath}`);
    yield* Console.log(`Logs:   ${LOG_FILE}`);
  }).pipe(
    Effect.catchTag('DaemonAlreadyRunningError', (e) =>
      Console.log(`Daemon is already running (pid ${e.pid})`)
    ),
    Effect.catchTag('DaemonStartError', (e) =>
      Console.error(`Failed to start daemon: ${e.message}`)
    ),
    exit0
  );
}

export function daemonStopCommand(): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* Console.log('Stopping vigie daemon...');
    yield* manager.stop();
    yield* Console.log('Daemon stopped.');
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () => Console.log('No daemon is running.')),
    exit0
  );
}

export function daemonStatusCommand(): Effect.Effect<void> {
  return Effect.gen(function* () {
    const info = yield* manager.status();
    yield* Console.log(`Daemon status: running (pid ${info.pid})`);
    yield* Console.log(`Uptime:  ${formatUptime(info.startedAt)}`);
    yield* Console.log(`Socket:  ${info.socketPath}`);
    yield* Console.log(`Version: ${info.version}`);
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () => Console.log('Daemon is not running.')),
    exit0
  );
}

export function daemonLogsCommand(follow: boolean): Effect.Effect<void> {
  if (follow) {
    return Effect.gen(function* () {
      yield* Console.log(`Tailing ${LOG_FILE}...`);
      yield* Effect.tryPromise({
        try: async () => {
          const proc = Bun.spawn(['tail', '-f', LOG_FILE], {
            stdout: 'inherit',
            stderr: 'inherit',
          });
          await proc.exited;
        },
        catch: (err) => (err instanceof Error ? err : new Error(String(err))),
      });
    }).pipe(
      Effect.catchCause(() => Console.error('Failed to tail logs')),
      exit0
    );
  }

  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: async () => {
        const file = Bun.file(LOG_FILE);
        if (!(await file.exists())) {
          console.log('No daemon logs found.');
          return;
        }
        const content = await file.text();
        const lines = content.split('\n');
        const tail = lines.slice(-50);
        console.log(tail.join('\n'));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }).pipe(
    Effect.catchCause(() => Console.error('Failed to read logs')),
    exit0
  );
}

export function daemonRestartCommand(): Effect.Effect<void> {
  return Effect.gen(function* () {
    if (yield* manager.isRunning()) {
      yield* Console.log('Stopping daemon...');
      yield* manager.stop();
    }
    yield* Console.log('Starting daemon...');
    const info = yield* manager.start();
    yield* Console.log(`Daemon started (pid ${info.pid})`);
    yield* Console.log(`Socket: ${info.socketPath}`);
    yield* Console.log(`Logs:   ${LOG_FILE}`);
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () => Effect.void),
    Effect.catchTag('DaemonAlreadyRunningError', (e) =>
      Console.log(`Daemon is already running (pid ${e.pid})`)
    ),
    Effect.catchTag('DaemonStartError', (e) => Console.error(`Failed: ${e.message}`)),
    exit0
  );
}

export function daemonAttachCommand(): Effect.Effect<void> {
  return Effect.gen(function* () {
    const info = yield* manager.status();
    yield* Console.log(
      `Attached to daemon (pid ${info.pid}, uptime ${formatUptime(info.startedAt)})`
    );
    yield* Console.log(`Tailing ${LOG_FILE}...`);
    yield* Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: async () => {
          const p = Bun.spawn(['tail', '-f', LOG_FILE], { stdout: 'inherit', stderr: 'inherit' });
          await p.exited;
        },
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });
    }).pipe(Effect.catchCause(() => Console.error('Failed to tail logs')));
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () =>
      Console.log('Daemon is not running. Start with `vigie daemon start`.')
    ),
    exit0
  );
}
