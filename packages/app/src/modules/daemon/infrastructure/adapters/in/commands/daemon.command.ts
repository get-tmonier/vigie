import { Console, Data, Effect } from 'effect';
import { AppLayer, runDaemon } from '#dependencies';
import { createBunProcessManager } from '#modules/daemon/infrastructure/adapters/out/bun-process-manager.adapter';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';

class DaemonCommandError extends Data.TaggedError('DaemonCommandError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const exit0 = Effect.ensuring(Effect.sync(() => process.exit(0)));

function formatUptime(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function daemonStartCommand(foreground: boolean) {
  if (foreground) {
    return Effect.gen(function* () {
      const config = yield* DaemonConfig;
      const manager = createBunProcessManager(config);
      const running = yield* manager.isRunning();
      if (running) {
        const info = yield* manager.status();
        yield* Console.log(
          `Daemon already running (pid ${info.pid}). Use \`vigie daemon attach\` to follow its logs.`
        );
        return;
      }
      yield* Console.log('Starting daemon in foreground...');
      return yield* runDaemon.pipe(Effect.provide(AppLayer));
    });
  }

  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
    yield* Console.log('Starting vigie daemon...');
    const info = yield* manager.start();
    yield* Console.log(`Daemon started (pid ${info.pid})`);
    yield* Console.log(`Socket: ${info.socketPath}`);
    yield* Console.log(`Logs:   ${config.logFile}`);
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

export function daemonStopCommand() {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
    yield* Console.log('Stopping vigie daemon...');
    yield* manager.stop();
    yield* Console.log('Daemon stopped.');
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () => Console.log('No daemon is running.')),
    exit0
  );
}

export function daemonStatusCommand() {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
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

export function daemonLogsCommand(follow: boolean) {
  if (follow) {
    return Effect.gen(function* () {
      const { logFile } = yield* DaemonConfig;
      yield* Console.log(`Tailing ${logFile}...`);
      yield* Effect.tryPromise({
        try: async () => {
          const proc = Bun.spawn(['tail', '-f', logFile], {
            stdout: 'inherit',
            stderr: 'inherit',
          });
          await proc.exited;
        },
        catch: (err) =>
          new DaemonCommandError({
            message: err instanceof Error ? err.message : String(err),
            cause: err,
          }),
      });
    }).pipe(
      Effect.catchCause(() => Console.error('Failed to tail logs')),
      exit0
    );
  }

  return Effect.gen(function* () {
    const { logFile } = yield* DaemonConfig;
    yield* Effect.tryPromise({
      try: async () => {
        const file = Bun.file(logFile);
        if (!(await file.exists())) {
          console.log('No daemon logs found.');
          return;
        }
        const content = await file.text();
        const lines = content.split('\n');
        const tail = lines.slice(-50);
        console.log(tail.join('\n'));
      },
      catch: (err) =>
        new DaemonCommandError({
          message: err instanceof Error ? err.message : String(err),
          cause: err,
        }),
    });
  }).pipe(
    Effect.catchCause(() => Console.error('Failed to read logs')),
    exit0
  );
}

export function daemonRestartCommand() {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
    if (yield* manager.isRunning()) {
      yield* Console.log('Stopping daemon...');
      yield* manager.stop();
    }
    yield* Console.log('Starting daemon...');
    const info = yield* manager.start();
    yield* Console.log(`Daemon started (pid ${info.pid})`);
    yield* Console.log(`Socket: ${info.socketPath}`);
    yield* Console.log(`Logs:   ${config.logFile}`);
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () => Effect.void),
    Effect.catchTag('DaemonAlreadyRunningError', (e) =>
      Console.log(`Daemon is already running (pid ${e.pid})`)
    ),
    Effect.catchTag('DaemonStartError', (e) => Console.error(`Failed: ${e.message}`)),
    exit0
  );
}

export function daemonAttachCommand() {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
    const info = yield* manager.status();
    yield* Console.log(
      `Attached to daemon (pid ${info.pid}, uptime ${formatUptime(info.startedAt)})`
    );
    yield* Console.log(`Tailing ${config.logFile}...`);
    yield* Effect.tryPromise({
      try: async () => {
        const p = Bun.spawn(['tail', '-f', config.logFile], {
          stdout: 'inherit',
          stderr: 'inherit',
        });
        await p.exited;
      },
      catch: (e) =>
        new DaemonCommandError({ message: e instanceof Error ? e.message : String(e), cause: e }),
    }).pipe(Effect.catchCause(() => Console.error('Failed to tail logs')));
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', () =>
      Console.log('Daemon is not running. Start with `vigie daemon start`.')
    ),
    exit0
  );
}
