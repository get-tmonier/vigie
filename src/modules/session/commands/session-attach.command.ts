import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { Console, Effect } from 'effect';
import { createBunProcessManager } from '#modules/daemon/adapters/bun-process-manager.adapter.js';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors.js';
import { DB_FILE, SOCKET_PATH, STDIN_SOCKET_PATH } from '#modules/daemon/paths.js';
import { createKeybindInterceptor } from '#terminal/keybind-interceptor.js';
import { initStatusBar, resizeStatusBar, teardownStatusBar } from '#terminal/status-bar-live.js';
import { createTuiRenderer } from '#vterm/tui-renderer.js';
import { createVTerm } from '#vterm/vterm.js';
import { createUnixSocketClient } from '../adapters/unix-socket-client.adapter.js';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

interface SessionRow {
  id: string;
  agent_type: string;
  mode: string;
  status: string;
  cwd: string;
  git_branch: string | null;
  claude_session_id: string | null;
}

export function sessionAttachCommand(partialId: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    if (!existsSync(DB_FILE)) {
      yield* Console.error('No sessions found. Start the daemon first.');
      return;
    }

    const db = new Database(DB_FILE, { readonly: true });
    const rows = db
      .prepare('SELECT * FROM sessions WHERE id LIKE $prefix')
      .all({ $prefix: `${partialId}%` }) as SessionRow[];
    const inputHistory = rows[0]
      ? (db
          .prepare(
            'SELECT text, source FROM input_history WHERE session_id = $id ORDER BY timestamp ASC LIMIT 50'
          )
          .all({ $id: rows[0].id }) as Array<{ text: string; source: string }>)
      : [];
    db.close();

    if (rows.length === 0) {
      yield* Console.error(`No session found matching "${partialId}".`);
      return;
    }

    if (rows.length > 1) {
      yield* Console.error(`Multiple sessions match "${partialId}". Be more specific:`);
      for (const row of rows) {
        yield* Console.error(`  ${row.id.slice(0, 8)}  ${row.status}  ${row.mode}  ${row.cwd}`);
      }
      return;
    }

    const session = rows[0];

    if (session.status !== 'active') {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} has ended. Use \`tmonier session resume --id ${session.id.slice(0, 8)}\` to start a new session continuing from it.`
      );
      return;
    }

    if (session.mode !== 'interactive') {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} is in ${session.mode} mode. Only interactive sessions can be attached.`
      );
      return;
    }

    const manager = createBunProcessManager();
    const running = yield* manager.isRunning();

    if (!running) {
      return yield* new DaemonNotRunningError({
        message: 'Daemon is not running. Start it with `tmonier daemon start`.',
      });
    }

    const cols = process.stdout.columns ?? 80;
    const rows_ = process.stdout.rows ?? 24;
    let viewportRows = rows_ - 1;

    const vterm = createVTerm({ cols, rows: viewportRows });
    const renderer = createTuiRenderer({ cols, rows: rows_, reservedBottom: 1 });

    const client = createUnixSocketClient();
    yield* client.connect(SOCKET_PATH);

    // CRITICAL: Register ALL message handlers BEFORE sending attach request.
    // The daemon replays terminal history right after session:spawned, so
    // our pty-output handler must be ready to receive it immediately.

    let resolveSpawn: () => void;
    let rejectSpawn: (error: Error) => void;
    const spawnPromise = new Promise<void>((resolve, reject) => {
      resolveSpawn = resolve;
      rejectSpawn = reject;
    });

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

    // replayDrainPromise resolves when the daemon has sent all replay chunks
    // AND all those writes have been fully parsed by xterm (write counter hits 0).
    let resolveReplayDrain: () => void;
    const replayDrainPromise = new Promise<void>((resolve) => {
      resolveReplayDrain = resolve;
    });
    let replayMsgReceived = false;
    let pendingReplayWrites = 0;
    let spawnForcedResize = false;
    // rendererActive gates all render callbacks — set synchronously after renderer.activate()
    let rendererActive = false;
    // Called on each live pty-output during the forced-resize quiet window
    let onLivePtyOutput: (() => void) | null = null;
    // Tracks the current rowOffset so we can detect when the cursor scrolls outside the viewport
    let currentRowOffset = 0;

    function checkReplayDrain() {
      if (replayMsgReceived && pendingReplayWrites === 0) resolveReplayDrain();
    }

    client.onClose(() => {
      resolveDisconnect();
    });

    client.onMessage((msg) => {
      if (!('sessionId' in msg) || msg.sessionId !== session.id) return;

      switch (msg.type) {
        case 'session:spawned':
          if (msg.ptyCols && msg.ptyRows) {
            vterm.resize(msg.ptyCols, msg.ptyRows);
          }
          spawnForcedResize = msg.forcedResize ?? false;
          resolveSpawn();
          break;
        case 'session:spawn-failed':
          rejectSpawn(new Error(msg.error));
          break;
        case 'session:error-response':
          rejectSpawn(new Error(msg.error));
          break;
        case 'session:replay-complete':
          replayMsgReceived = true;
          checkReplayDrain();
          break;
        case 'session:pty-output': {
          const bytes = Buffer.from(msg.data, 'base64');
          if (!replayMsgReceived) {
            // Replay write — track it so we know when xterm has processed all of them
            pendingReplayWrites++;
            vterm.write(bytes, () => {
              pendingReplayWrites--;
              checkReplayDrain();
              if (rendererActive) renderer.render(vterm.getScreen());
            });
          } else {
            onLivePtyOutput?.();
            vterm.write(bytes, () => {
              if (rendererActive) {
                const screen = vterm.getScreen();
                const newRowOffset = Math.max(0, screen.cursorY - viewportRows + 1);
                if (newRowOffset !== currentRowOffset) {
                  currentRowOffset = newRowOffset;
                  renderer.setRowOffset(newRowOffset);
                  renderer.fullRender(screen);
                } else {
                  renderer.render(screen);
                }
              }
            });
          }
          break;
        }
        case 'session:pty-exited':
          resolveExit(msg.exitCode);
          break;
        case 'session:pty-resized':
          vterm.resize(msg.ptyCols, msg.ptyRows);
          if (rendererActive) {
            const screen = vterm.getScreen();
            currentRowOffset = Math.max(0, screen.cursorY - viewportRows + 1);
            renderer.setRowOffset(currentRowOffset);
            renderer.fullRender(screen);
          }
          break;
      }
    });

    // NOW send attach — handler is ready to receive replayed history immediately
    yield* client.send({
      type: 'session:attach',
      sessionId: session.id,
      cols,
      rows: rows_,
    });

    yield* Effect.promise(() => spawnPromise);
    // Wait until all replay chunks are fully parsed by xterm.
    // 500ms fallback for daemons that predate session:replay-complete.
    yield* Effect.promise(() =>
      Promise.race([replayDrainPromise, new Promise<void>((r) => setTimeout(r, 500))])
    );
    // When the daemon forced a PTY resize (CLI-only session), Claude Code redraws
    // its TUI in response to SIGWINCH. Those bytes arrive as live pty-output and
    // must be fully parsed before we snapshot the screen with fullRender.
    // Use quiet detection: wait until 300ms of silence after the last live pty-output
    // (max 3s) so we snapshot after the redraw has fully settled.
    if (spawnForcedResize) {
      yield* Effect.promise(() =>
        new Promise<void>((resolve) => {
          let quietTimer: ReturnType<typeof setTimeout> = setTimeout(resolve, 300);
          onLivePtyOutput = () => {
            clearTimeout(quietTimer);
            quietTimer = setTimeout(resolve, 300);
          };
          setTimeout(resolve, 3000);
        }).finally(() => {
          onLivePtyOutput = null;
        })
      );
    }

    const shortId = session.id.slice(0, 8);

    // Print input history so the user can scroll up to see what happened
    if (inputHistory.length > 0) {
      const sep = '\u2500'.repeat(50);
      process.stdout.write(`\x1b[2m${sep}\x1b[0m\n`);
      for (const entry of inputHistory) {
        const prefix = entry.source === 'browser' ? '\x1b[2m[web]\x1b[0m' : '\x1b[2m[cli]\x1b[0m';
        process.stdout.write(`${prefix} \x1b[1m›\x1b[0m ${entry.text}\n`);
      }
      process.stdout.write(`\x1b[2m${sep}\x1b[0m\n`);
    }

    // Pre-launch banner — visible before Claude Code's TUI takes over
    const bannerWidth = 50;
    const line1 = `  \u2699 tmonier session ${shortId}`;
    const line2 = '  Ctrl-B d: detach | dashboard: app.tmonier.com';
    const pad1 = ' '.repeat(Math.max(0, bannerWidth - line1.length));
    const pad2 = ' '.repeat(Math.max(0, bannerWidth - line2.length));
    process.stdout.write(
      `\x1b[33m\u256D${'─'.repeat(bannerWidth)}\u256E\n` +
        `\u2502${line1}${pad1}\u2502\n` +
        `\u2502${line2}${pad2}\u2502\n` +
        `\u2570${'─'.repeat(bannerWidth)}\u256F\x1b[0m\n`
    );

    // Raw mode so keystrokes are delivered immediately
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    renderer.activate();
    rendererActive = true;
    const initScreen = vterm.getScreen();
    currentRowOffset = Math.max(0, initScreen.cursorY - viewportRows + 1);
    renderer.setRowOffset(currentRowOffset);
    renderer.fullRender(initScreen);

    const startedAt = Date.now();
    initStatusBar(renderer, session.id, startedAt);

    // Forward stdin via dedicated stdin socket (Bun write-blocking bug workaround)
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
            sessionId: session.id,
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
      const msg = JSON.stringify({ sessionId: session.id, data: processed.toString('base64') });
      stdinSocket.write(`${msg}\n`);
    };
    process.stdin.on('data', onStdinData);
    process.stdin.resume();

    const onResize = () => {
      const newCols = process.stdout.columns ?? 80;
      const newRows = process.stdout.rows ?? 24;
      const newViewportRows = newRows - 1;
      viewportRows = newViewportRows;
      // VTerm stays at PTY dims — do NOT call vterm.resize()
      renderer.resize(newCols, newRows);
      const resizeScreen = vterm.getScreen();
      currentRowOffset = Math.max(0, resizeScreen.cursorY - newViewportRows + 1);
      renderer.setRowOffset(currentRowOffset);
      renderer.fullRender(resizeScreen);
      resizeStatusBar();
      // daemon does its own rows-1, so send full newRows
      Effect.runSync(
        client.send({
          type: 'session:cli-resize',
          sessionId: session.id,
          cols: newCols,
          rows: newRows,
        })
      );
    };
    process.stdout.on('resize', onResize);

    // Wait for PTY exit, detach, or daemon disconnect
    type AttachResult =
      | { type: 'exit'; exitCode: number }
      | { type: 'detach' }
      | { type: 'disconnect' };
    const result = yield* Effect.promise(() =>
      Promise.race([
        exitPromise.then((exitCode): AttachResult => ({ type: 'exit', exitCode })),
        detachPromise.then((): AttachResult => ({ type: 'detach' })),
        disconnectPromise.then((): AttachResult => ({ type: 'disconnect' })),
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
        `\x1b[31m\u2699 tmonier\x1b[0m | daemon disconnected — session \x1b[1m${shortId}\x1b[0m was interrupted after ${elapsed}`
      );
      yield* Console.log('  Restart daemon: \x1b[1mtmonier daemon start\x1b[0m');
      yield* Console.log(`  Resume:         \x1b[1mtmonier session resume --id ${shortId}\x1b[0m`);
      yield* Console.log(`\x1b[31m${sep}\x1b[0m`);
    }
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', (e) => Console.error(e.message)),
    Effect.catchTag('IpcConnectionError', (e) => Console.error(`IPC error: ${e.message}`)),
    Effect.ensuring(
      Effect.promise(async () => {
        await new Promise<void>((resolve) => {
          process.stdout.write('', () => resolve());
        });
        process.exit(0);
      })
    )
  );
}
