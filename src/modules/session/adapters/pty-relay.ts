import { Console, Effect } from 'effect';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors.js';
import { STDIN_SOCKET_PATH } from '#modules/daemon/paths.js';
import { createKeybindInterceptor } from '#terminal/keybind-interceptor.js';
import { initStatusBar, resizeStatusBar, teardownStatusBar } from '#terminal/status-bar-live.js';
import { createTuiRenderer } from '#vterm/tui-renderer.js';
import { createVTerm } from '#vterm/vterm.js';
import type { IpcClientShape } from '../ports/ipc-client.port.js';

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

export function attachPtyRelay(
  client: IpcClientShape,
  options: PtyRelayOptions
): Effect.Effect<PtyRelayResult, DaemonNotRunningError> {
  return Effect.gen(function* () {
    const { sessionId } = options;
    const startedAt = options.startedAt ?? Date.now();

    let resolveExit: (exitCode: number) => void;
    const exitPromise = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });

    let resolveDetach: () => void;
    const detachPromise = new Promise<void>((resolve) => {
      resolveDetach = resolve;
    });

    let resolveDisconnect: () => void;
    const disconnectPromise = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });

    client.onClose(() => {
      resolveDisconnect();
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
          resolveExit(msg.exitCode);
          break;
      }
    });

    // Pre-launch banner — visible before alt screen hides it
    const shortId = sessionId.slice(0, 8);
    const bannerWidth = 50;
    const line1 = `  \u2699 tmonier session ${shortId}`;
    const line2 = '  Ctrl-B d: detach | dashboard: app.tmonier.com';
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

    // Raw mode so keystrokes are delivered immediately (not line-buffered)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    renderer.activate();
    initStatusBar(renderer, sessionId, startedAt, options.infoLine);

    // Forward stdin to daemon via a dedicated stdin socket.
    // The main IPC socket has a Bun bug where heavy server->client writes
    // (PTY output) prevent the data handler from firing for client->server data.
    interface StdinSocket {
      write(data: string | Uint8Array): number;
      terminate(): void;
    }
    const stdinSocket = yield* Effect.tryPromise({
      try: () =>
        new Promise<StdinSocket>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Stdin socket timeout')), 5000);
          Bun.connect({
            unix: STDIN_SOCKET_PATH,
            socket: {
              open(s) {
                clearTimeout(timeout);
                resolve(s as unknown as StdinSocket);
              },
              data() {},
              close() {},
              error(_s, err) {
                clearTimeout(timeout);
                reject(err);
              },
            },
          }).catch(reject);
        }),
      catch: (err) =>
        new DaemonNotRunningError({
          message: `Failed to connect stdin socket: ${err instanceof Error ? err.message : String(err)}`,
        }),
    });

    const triggerDetach = () => {
      try {
        Effect.runSync(
          client.send({
            type: 'session:detach',
            sessionId,
          })
        );
      } catch {
        // Best-effort — detach locally even if IPC send fails
      }
      resolveDetach();
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

    // Local terminal resize -> daemon + vterm + renderer
    const onResize = () => {
      const newCols = process.stdout.columns ?? 80;
      const newRows = process.stdout.rows ?? 24;
      const newViewportRows = newRows - 1;
      vterm.resize(newCols, newViewportRows);
      renderer.resize(newCols, newRows);
      renderer.fullRender(vterm.getScreen());
      resizeStatusBar();
      // daemon does its own rows-1, so send full newRows
      Effect.runSync(
        client.send({
          type: 'session:cli-resize',
          sessionId,
          cols: newCols,
          rows: newRows,
        })
      );
    };
    process.stdout.on('resize', onResize);

    // Wait for PTY exit, detach, or daemon disconnect
    const result = yield* Effect.promise(() =>
      Promise.race([
        exitPromise.then((exitCode): PtyRelayResult => ({ type: 'exit', exitCode })),
        detachPromise.then((): PtyRelayResult => ({ type: 'detach' })),
        disconnectPromise.then((): PtyRelayResult => ({ type: 'disconnect' })),
      ])
    );

    // Cleanup
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
        `\x1b[33m\u2699 tmonier\x1b[0m | session \x1b[1m${shortId}\x1b[0m ended (exit ${result.exitCode}) after ${elapsed}`
      );
      yield* Console.log(`\x1b[33m${sep}\x1b[0m`);
    } else if (result.type === 'detach') {
      yield* Console.log(`\n\x1b[33m${sep}\x1b[0m`);
      yield* Console.log(
        `\x1b[33m\u2699 tmonier\x1b[0m | detached from session \x1b[1m${shortId}\x1b[0m after ${elapsed}`
      );
      yield* Console.log('  Re-attach: \x1b[1mtmonier attach\x1b[0m');
      yield* Console.log(`\x1b[33m${sep}\x1b[0m`);
    } else {
      yield* Console.log(`\n\x1b[31m${sep}\x1b[0m`);
      yield* Console.log(
        `\x1b[31m\u2699 tmonier\x1b[0m | daemon disconnected \u2014 session \x1b[1m${shortId}\x1b[0m was interrupted after ${elapsed}`
      );
      yield* Console.log('  Restart daemon: \x1b[1mtmonier daemon start\x1b[0m');
      yield* Console.log(`  Resume:         \x1b[1mtmonier session resume --id ${shortId}\x1b[0m`);
      yield* Console.log(`\x1b[31m${sep}\x1b[0m`);
    }

    return result;
  });
}
