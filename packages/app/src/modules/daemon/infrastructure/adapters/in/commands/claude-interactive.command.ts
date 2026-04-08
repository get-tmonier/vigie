import { Console, Deferred, Effect, Exit } from 'effect';
import { getGitContext } from '#lib/git-context';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors';
import { createBunProcessManager } from '#modules/daemon/infrastructure/adapters/out/bun-process-manager.adapter';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { attachPtyRelay } from '../pty-relay';
import { createUnixSocketClient } from '../unix-socket-client.adapter';

const flushStdoutAndExit = Effect.callback<never, never>((resume) => {
  process.stdout.write('', () => {
    process.exit(0);
    resume(Exit.succeed(undefined as never));
  });
});

export function claudeInteractiveCommand() {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
    const running = yield* manager.isRunning();

    if (!running) {
      return yield* new DaemonNotRunningError({
        message: 'Daemon is not running. Start it with `vigie daemon start`.',
      });
    }

    const cwd = process.cwd();
    const sessionId = crypto.randomUUID();
    const gitCtx = yield* getGitContext(cwd);

    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;

    // Connect to daemon via IPC
    const client = createUnixSocketClient();
    yield* client.connect(config.socketPath);

    // CRITICAL: Register ALL message handlers BEFORE sending spawn request.
    // The daemon drains buffered PTY output synchronously when it registers
    // onOutput, which happens right after sending session:spawned + session:started.
    // If our handler isn't ready, the initial TUI render is silently lost.

    const spawnDeferred = yield* Deferred.make<number>();
    const services = yield* Effect.services();

    client.onMessage((msg) => {
      if (!('sessionId' in msg) || msg.sessionId !== sessionId) return;

      switch (msg.type) {
        case 'session:spawned':
          Effect.runForkWith(services)(Deferred.succeed(spawnDeferred, msg.pid));
          break;
        case 'session:spawn-failed':
          Effect.runForkWith(services)(Deferred.die(spawnDeferred, new Error(msg.error)));
          break;
      }
    });

    // NOW send spawn request — handler is ready to receive output immediately
    yield* client.send({
      type: 'session:spawn-interactive',
      sessionId,
      agentType: 'claude',
      cwd,
      cols,
      rows,
      gitBranch: gitCtx.branch,
      gitRemoteUrl: gitCtx.remoteUrl,
      repoName: gitCtx.repoName,
    });

    // Wait for spawn confirmation
    yield* Deferred.await(spawnDeferred);

    const startedAt = Date.now();

    // Relay PTY I/O until session ends or detach
    const result = yield* attachPtyRelay(client, { sessionId, startedAt });

    if (result.type === 'detach') {
      yield* Console.log(
        'Session is still running in the background. Re-attach with `vigie attach`.'
      );
    } else if (result.type === 'disconnect') {
      // Message already printed by pty-relay
    }
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', (e) => Console.error(e.message)),
    Effect.catchTag('IpcConnectionError', (e) => Console.error(`IPC error: ${e.message}`)),
    Effect.ensuring(flushStdoutAndExit)
  );
}
