import { Effect } from 'effect';
import type { AgentProcessShape } from '#modules/agent-session/application/ports/out/agent-process.port';
import type { SessionLogShape } from '#modules/agent-session/application/ports/out/session-log.port';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import type {
  PtyEntry,
  PtyManagerCallbacks,
  PtySpawnFn,
} from '#modules/agent-session/infrastructure/pty-manager.types';
import type { SessionId } from '#shared/kernel/session/session-id';
import { type LineBuffer, stripAnsiAndBuffer } from '#shared/lib/input-line-buffer';

interface PtyManagerDeps {
  spawner: PtySpawnFn;
  callbacks: PtyManagerCallbacks;
  terminalRepo: SessionLogShape;
}

export function createPtyManager(deps: PtyManagerDeps): AgentProcessShape {
  const { spawner, callbacks, terminalRepo } = deps;

  // Internal state (replaces PtyRegistry)
  const ptyHandles = new Map<SessionId, PtyEntry>();
  const sessionConnections = new Map<SessionId, string>();
  const connSessions = new Map<string, SessionId>();
  const inputLineBuffers = new Map<string, LineBuffer>();

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) =>
        Effect.logWarning('PtyManager event failed (non-fatal)', cause)
      )
    );
  }

  function applyResizePriority(sessionId: SessionId): { cols: number; rows: number } | null {
    const entry = ptyHandles.get(sessionId);
    if (!entry) return null;

    let cols: number;
    let rows: number;
    if (entry.browserChannels.size > 0) {
      const first = entry.browserChannels.values().next().value;
      if (!first) return null;
      cols = first.cols;
      rows = first.rows;
    } else if (entry.cliChannels.size > 0) {
      const first = entry.cliChannels.values().next().value;
      if (!first) return null;
      cols = first.cols;
      rows = first.rows - 1;
    } else {
      return null;
    }

    entry.handle.resize(cols, rows);
    entry.ptyDimensions = { cols, rows };

    for (const connId of entry.cliChannels.keys()) {
      callbacks.sendToCliClient(
        connId,
        JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
      );
    }

    callbacks.onResized(sessionId, cols, rows);
    return { cols, rows };
  }

  function setupPtyLifecycle(sessionId: SessionId, entry: PtyEntry): void {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      terminalRepo.appendChunk(sessionId, base64, ts);

      for (const connId of entry.cliChannels.keys()) {
        callbacks.sendToCliClient(
          connId,
          JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 })
        );
      }

      callbacks.onOutput(sessionId, base64, ts);
    });

    fireAndForget(
      Effect.promise(() => entry.handle.wait()).pipe(
        Effect.flatMap((exitCode) =>
          Effect.sync(() => {
            callbacks.onProcessExited(sessionId, exitCode);

            for (const connId of entry.cliChannels.keys()) {
              callbacks.sendToCliClient(
                connId,
                JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
              );
            }

            ptyHandles.delete(sessionId);
          })
        )
      )
    );
  }

  function writeInputBytes(
    sessionId: SessionId,
    bytes: Uint8Array,
    source: 'cli' | 'browser'
  ): void {
    const entry = ptyHandles.get(sessionId);
    if (!entry) return;
    entry.handle.write(bytes);
    const base64 = Buffer.from(bytes).toString('base64');
    stripAnsiAndBuffer(inputLineBuffers, sessionId, base64, source, (text, src, ts) => {
      terminalRepo.appendInput(sessionId, text, src, ts);
      callbacks.onInputEcho(sessionId, text, src, ts);
    });
  }

  return {
    spawn(opts): Effect.Effect<{ pid: number }, AgentRunnerError> {
      return Effect.gen(function* () {
        const handle = yield* spawner(opts.command, opts.args, opts.cwd, opts.cols, opts.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: opts.cols, rows: opts.rows },
        };
        ptyHandles.set(opts.sessionId, entry);

        if (opts.connId) {
          connSessions.set(opts.connId, opts.sessionId);
          entry.cliChannels.set(opts.connId, { cols: opts.cols, rows: opts.rows });
        }

        setupPtyLifecycle(opts.sessionId, entry);

        return { pid: handle.pid };
      });
    },

    kill(sessionId) {
      const entry = ptyHandles.get(sessionId);
      if (entry) entry.handle.kill();
    },

    killAll() {
      for (const entry of ptyHandles.values()) {
        entry.handle.kill();
      }
    },

    getActivePid(sessionId) {
      return ptyHandles.get(sessionId)?.handle.pid ?? null;
    },

    attach(sessionId, connId, dims) {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return null;

      entry.cliChannels.set(connId, { cols: dims.cols, rows: dims.rows });
      connSessions.set(connId, sessionId);
      applyResizePriority(sessionId);

      const chunks = terminalRepo.getAllChunks(sessionId);
      return { chunks, pid: entry.handle.pid };
    },

    detach(sessionId, connId) {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return;
      entry.cliChannels.delete(connId);
      connSessions.delete(connId);
      applyResizePriority(sessionId);
    },

    updateCliResize(sessionId, connId, cols, rows) {
      const entry = ptyHandles.get(sessionId);
      if (entry?.cliChannels.has(connId)) {
        entry.cliChannels.set(connId, { cols, rows });
        applyResizePriority(sessionId);
      }
    },

    handleDisconnect(connId) {
      const sessionId = connSessions.get(connId);
      if (!sessionId) return;

      const entry = ptyHandles.get(sessionId);
      if (entry) {
        entry.cliChannels.delete(connId);
        connSessions.delete(connId);
        applyResizePriority(sessionId);
      } else {
        // No PTY running — notify domain to mark session ended
        callbacks.onProcessExited(sessionId, -1);
        connSessions.delete(connId);
        sessionConnections.delete(sessionId);
      }
    },

    writeInput(sessionId, data, source) {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      writeInputBytes(sessionId, bytes, source);
    },

    writeBinaryInput(sessionId, data) {
      writeInputBytes(sessionId, data, 'browser');
    },

    addBrowserChannel(sessionId, connId, dims) {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return null;
      entry.browserChannels.set(connId, dims);
      applyResizePriority(sessionId);
      return entry.handle.pid;
    },

    updateBrowserChannel(sessionId, connId, dims) {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return;
      entry.browserChannels.set(connId, dims);
      applyResizePriority(sessionId);
    },

    removeBrowserChannel(sessionId, connId) {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return;
      entry.browserChannels.delete(connId);
      applyResizePriority(sessionId);
    },

    trackConnection(sessionId, connId) {
      sessionConnections.set(sessionId, connId);
      connSessions.set(connId, sessionId);
    },

    getConnId(sessionId) {
      return sessionConnections.get(sessionId);
    },

    clearConnection(connId) {
      const sessionId = connSessions.get(connId);
      if (sessionId) {
        sessionConnections.delete(sessionId);
      }
      connSessions.delete(connId);
    },
  };
}
