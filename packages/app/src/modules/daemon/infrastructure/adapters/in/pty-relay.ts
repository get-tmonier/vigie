import { Console, Deferred, Duration, Effect, Exit } from 'effect';
import type { IpcClientShape } from '#modules/daemon/application/ports/in/ipc-client.port';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { createKeybindInterceptor } from '#shared/lib/cli-terminal/keybind-interceptor';
import {
  initStatusBar,
  resizeStatusBar,
  teardownStatusBar,
} from '#shared/lib/cli-terminal/status-bar-live';
import { createTuiRenderer } from '#shared/lib/vterm/tui-renderer';
import { createVTerm } from '#shared/lib/vterm/vterm';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

interface PtyRelayOptions {
  readonly sessionId: string;
  readonly skipHeader?: boolean;
  readonly startedAt?: number;
  readonly infoLine?: string;
}

type PtyRelayResult =
  | { type: 'exit'; exitCode: number }
  | { type: 'detach' }
  | { type: 'disconnect' };

type StdinSocket = Pick<Bun.Socket<undefined>, 'write' | 'terminate'>;

function connectStdinSocket(stdinSocketPath: string) {
  return Effect.callback<StdinSocket, DaemonNotRunningError>((resume) => {
    Bun.connect({
      unix: stdinSocketPath,
      socket: {
        open(s) {
          resume(Exit.succeed(s));
        },
        data() {},
        close() {},
        error(_s, err) {
          resume(
            Exit.fail(
              new DaemonNotRunningError({
                message: `Failed to connect stdin socket: ${err.message}`,
              })
            )
          );
        },
      },
    }).catch((err) =>
      resume(
        Exit.fail(
          new DaemonNotRunningError({
            message: `Failed to connect stdin socket: ${err instanceof Error ? err.message : String(err)}`,
          })
        )
      )
    );
  }).pipe(
    Effect.timeout(Duration.seconds(5)),
    Effect.mapError((err) =>
      err._tag === 'TimeoutError'
        ? new DaemonNotRunningError({ message: 'Stdin socket timeout' })
        : err
    )
  );
}

export function attachPtyRelay(client: IpcClientShape, options: PtyRelayOptions) {
  return Effect.gen(function* () {
    const { stdinSocketPath } = yield* DaemonConfig;
    const { sessionId } = options;
    const startedAt = options.startedAt ?? Date.now();

    const exitDeferred = yield* Deferred.make<number>();
    const detachDeferred = yield* Deferred.make<void>();
    const disconnectDeferred = yield* Deferred.make<void>();
    const services = yield* Effect.services();

    client.onClose(() => {
      Effect.runForkWith(services)(Deferred.succeed(disconnectDeferred, undefined));
    });

    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    const viewportRows = rows - 1;

    const vterm = createVTerm({ cols, rows: viewportRows });
    const renderer = createTuiRenderer({ cols, rows, reservedBottom: 1 });

    client.onMessage((msg) => {
      if (!('sessionId' in msg) || msg.sessionId !== sessionId) return;

      switch (msg.type) {
        case 'session:pty-output': {
          const bytes = Buffer.from(msg.data, 'base64');
          vterm.write(bytes, () => renderer.render(vterm.getScreen()));
          break;
        }
        case 'session:pty-exited':
          Effect.runForkWith(services)(Deferred.succeed(exitDeferred, msg.exitCode));
          break;
      }
    });

    const shortId = sessionId.slice(0, 8);
    const bannerWidth = 50;
    const line1 = `  \u2699 vigie session ${shortId}`;
    const line2 = '  Ctrl-B d: detach | dashboard: localhost:19191';
    const pad1 = ' '.repeat(Math.max(0, bannerWidth - line1.length));
    const pad2 = ' '.repeat(Math.max(0, bannerWidth - line2.length));
    let banner =
      `\x1b[33m\u256D${'─'.repeat(bannerWidth)}\u256E\n` +
      `\u2502${line1}${pad1}\u2502\n` +
      `\u2502${line2}${pad2}\u2502\n`;
    if (options.infoLine) {
      const infoText = `  ${options.infoLine}`;
      const infoPad = ' '.repeat(Math.max(0, bannerWidth - infoText.length));
      banner += `\u2502${infoText}${infoPad}\u2502\n`;
    }
    banner += `\u2570${'─'.repeat(bannerWidth)}\u256F\x1b[0m\n`;
    process.stdout.write(banner);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    renderer.activate();
    initStatusBar(renderer, sessionId, startedAt, options.infoLine);

    const restoreTerminal = () => {
      renderer.deactivate();
      teardownStatusBar(false);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };
    const onSigint = () => {
      restoreTerminal();
      process.exit(130);
    };
    const onSigterm = () => {
      restoreTerminal();
      process.exit(143);
    };
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);

    const stdinSocket = yield* connectStdinSocket(stdinSocketPath);

    const triggerDetach = () => {
      Effect.runForkWith(services)(
        client.send({ type: 'session:detach', sessionId }).pipe(Effect.catch(() => Effect.void))
      );
      Effect.runForkWith(services)(Deferred.succeed(detachDeferred, undefined));
    };

    const interceptor = createKeybindInterceptor({ onDetach: triggerDetach });

    const onStdinData = (chunk: Buffer) => {
      const processed = interceptor.process(chunk);
      if (processed === null || processed.length === 0) return;
      const msg = JSON.stringify({ sessionId, data: processed.toString('base64') });
      stdinSocket.write(`${msg}\n`);
    };
    process.stdin.on('data', onStdinData);
    process.stdin.resume();

    const onResize = () => {
      const newCols = process.stdout.columns ?? 80;
      const newRows = process.stdout.rows ?? 24;
      const newViewportRows = newRows - 1;
      vterm.resize(newCols, newViewportRows);
      renderer.resize(newCols, newRows);
      renderer.fullRender(vterm.getScreen());
      resizeStatusBar();
      Effect.runForkWith(services)(
        client
          .send({ type: 'session:cli-resize', sessionId, cols: newCols, rows: newRows })
          .pipe(Effect.catch(() => Effect.void))
      );
    };
    process.stdout.on('resize', onResize);

    const result = yield* Effect.raceAll([
      Deferred.await(exitDeferred).pipe(
        Effect.map((exitCode): PtyRelayResult => ({ type: 'exit', exitCode }))
      ),
      Deferred.await(detachDeferred).pipe(Effect.map((): PtyRelayResult => ({ type: 'detach' }))),
      Deferred.await(disconnectDeferred).pipe(
        Effect.map((): PtyRelayResult => ({ type: 'disconnect' }))
      ),
    ]);

    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);

    interceptor.destroy();
    renderer.deactivate();
    vterm.dispose();
    teardownStatusBar(result.type === 'detach' || result.type === 'disconnect');

    process.stdin.removeListener('data', onStdinData);
    process.stdout.removeListener('resize', onResize);
    process.stdin.pause();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    stdinSocket.terminate();
    yield* client.close();

    const elapsed = formatDuration(Date.now() - startedAt);
    const sep = '\u2500'.repeat(50);
    if (result.type === 'exit') {
      yield* Console.log(`\n\x1b[33m${sep}\x1b[0m`);
      yield* Console.log(
        `\x1b[33m\u2699 vigie\x1b[0m | session \x1b[1m${shortId}\x1b[0m ended (exit ${result.exitCode}) after ${elapsed}`
      );
      yield* Console.log(`\x1b[33m${sep}\x1b[0m`);
    } else if (result.type === 'detach') {
      yield* Console.log(`\n\x1b[33m${sep}\x1b[0m`);
      yield* Console.log(
        `\x1b[33m\u2699 vigie\x1b[0m | detached from session \x1b[1m${shortId}\x1b[0m after ${elapsed}`
      );
      yield* Console.log('  Re-attach: \x1b[1mvigie attach\x1b[0m');
      yield* Console.log(`\x1b[33m${sep}\x1b[0m`);
    } else {
      yield* Console.log(`\n\x1b[31m${sep}\x1b[0m`);
      yield* Console.log(
        `\x1b[31m\u2699 vigie\x1b[0m | daemon disconnected \u2014 session \x1b[1m${shortId}\x1b[0m was interrupted after ${elapsed}`
      );
      yield* Console.log('  Restart daemon: \x1b[1mvigie daemon start\x1b[0m');
      yield* Console.log(`  Resume:         \x1b[1mvigie session resume --id ${shortId}\x1b[0m`);
      yield* Console.log(`\x1b[31m${sep}\x1b[0m`);
    }

    return result;
  });
}
