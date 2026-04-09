import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { SessionLogShape } from '#modules/agent-session/application/ports/out/session-log.port';
import { createPtyManager } from '#modules/agent-session/infrastructure/pty-manager';
import type {
  PtyHandle,
  PtyManagerCallbacks,
  PtySpawnFn,
} from '#modules/agent-session/infrastructure/pty-manager.types';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';

function makeFakeHandle(overrides?: Partial<PtyHandle>): PtyHandle {
  return {
    pid: 1234,
    write: () => {},
    resize: () => {},
    kill: () => {},
    onOutput: () => {},
    wait: () => new Promise(() => {}), // never resolves by default
    ...overrides,
  };
}

function makeFakeSpawner(handle?: PtyHandle): PtySpawnFn {
  return (_cmd, _args, _cwd, _cols, _rows) => Effect.succeed(handle ?? makeFakeHandle());
}

function makeFakeCallbacks(overrides?: Partial<PtyManagerCallbacks>): PtyManagerCallbacks & {
  outputCalls: Array<{ sessionId: string; base64: string; ts: number }>;
  exitedCalls: Array<{ sessionId: string; exitCode: number }>;
  resizedCalls: Array<{ sessionId: string; cols: number; rows: number }>;
  inputEchoCalls: Array<{ sessionId: string; text: string; source: string; ts: number }>;
  cliMessages: Array<{ connId: string; msg: string }>;
} {
  const outputCalls: Array<{ sessionId: string; base64: string; ts: number }> = [];
  const exitedCalls: Array<{ sessionId: string; exitCode: number }> = [];
  const resizedCalls: Array<{ sessionId: string; cols: number; rows: number }> = [];
  const inputEchoCalls: Array<{ sessionId: string; text: string; source: string; ts: number }> = [];
  const cliMessages: Array<{ connId: string; msg: string }> = [];

  return {
    outputCalls,
    exitedCalls,
    resizedCalls,
    inputEchoCalls,
    cliMessages,
    onOutput(sessionId, base64, ts) {
      outputCalls.push({ sessionId, base64, ts });
      overrides?.onOutput?.(sessionId, base64, ts);
    },
    onProcessExited(sessionId, exitCode) {
      exitedCalls.push({ sessionId, exitCode });
      overrides?.onProcessExited?.(sessionId, exitCode);
    },
    onResized(sessionId, cols, rows) {
      resizedCalls.push({ sessionId, cols, rows });
      overrides?.onResized?.(sessionId, cols, rows);
    },
    onInputEcho(sessionId, text, source, ts) {
      inputEchoCalls.push({ sessionId, text, source, ts });
      overrides?.onInputEcho?.(sessionId, text, source, ts);
    },
    sendToCliClient(connId, msg) {
      cliMessages.push({ connId, msg });
      overrides?.sendToCliClient?.(connId, msg);
    },
  };
}

function makeFakeTerminalRepo(): SessionLogShape {
  let seq = 0;
  const chunks: Array<{ data: string; timestamp: number; seq: number }> = [];
  return {
    appendChunk(_sid, data, ts) {
      chunks.push({ data, timestamp: ts, seq: seq++ });
    },
    appendInput: () => {},
    getChunks: () => chunks,
    getAllChunks: () => chunks,
    getInputHistory: () => [],
  };
}

function makeManager(overrides?: {
  spawner?: PtySpawnFn;
  callbacks?: PtyManagerCallbacks;
  terminalRepo?: SessionLogShape;
}) {
  const callbacks = overrides?.callbacks ?? makeFakeCallbacks();
  return {
    callbacks: callbacks as ReturnType<typeof makeFakeCallbacks>,
    manager: createPtyManager({
      spawner: overrides?.spawner ?? makeFakeSpawner(),
      callbacks,
      terminalRepo: overrides?.terminalRepo ?? makeFakeTerminalRepo(),
    }),
  };
}

describe('PtyManager.spawn', () => {
  it('returns pid on success', async () => {
    const { manager } = makeManager();
    const result = await Effect.runPromise(
      manager.spawn({
        sessionId: makeSessionId('sess-1'),
        command: 'claude',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );
    expect(result.pid).toBe(1234);
  });

  it('registers the session so getActivePid works', async () => {
    const { manager } = makeManager();
    await Effect.runPromise(
      manager.spawn({
        sessionId: makeSessionId('sess-1'),
        command: 'claude',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );
    expect(manager.getActivePid(makeSessionId('sess-1'))).toBe(1234);
  });

  it('registers CLI channel when connId provided', async () => {
    const { manager, callbacks } = makeManager();
    await Effect.runPromise(
      manager.spawn({
        sessionId: makeSessionId('sess-1'),
        command: 'claude',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
        connId: 'conn-1',
      })
    );
    // handleDisconnect on a connId mapped to a live PTY should clean up the channel
    // but NOT call onProcessExited (that only happens when there's no PTY entry)
    manager.handleDisconnect('conn-1');
    expect(callbacks.exitedCalls).toHaveLength(0);
  });
});

describe('PtyManager.kill', () => {
  it('calls handle.kill for active session', async () => {
    let killed = false;
    const handle = makeFakeHandle({
      kill: () => {
        killed = true;
      },
    });
    const { manager } = makeManager({ spawner: makeFakeSpawner(handle) });

    await Effect.runPromise(
      manager.spawn({
        sessionId: makeSessionId('sess-1'),
        command: 'claude',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    manager.kill(makeSessionId('sess-1'));
    expect(killed).toBe(true);
  });

  it('is a no-op for unknown session', () => {
    const { manager } = makeManager();
    expect(() => manager.kill(makeSessionId('nonexistent'))).not.toThrow();
  });
});

describe('PtyManager.killAll', () => {
  it('kills all active sessions', async () => {
    const killed: string[] = [];
    const makeHandle = (id: string) =>
      makeFakeHandle({
        kill: () => {
          killed.push(id);
        },
      });

    let callCount = 0;
    const handles = [makeHandle('a'), makeHandle('b')];
    const spawner: PtySpawnFn = (_c, _a, _w, _co, _r) => Effect.succeed(handles[callCount++]);

    const mgr = createPtyManager({
      spawner,
      callbacks: makeFakeCallbacks(),
      terminalRepo: makeFakeTerminalRepo(),
    });

    await Effect.runPromise(
      mgr.spawn({
        sessionId: makeSessionId('s1'),
        command: 'c',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );
    await Effect.runPromise(
      mgr.spawn({
        sessionId: makeSessionId('s2'),
        command: 'c',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );
    mgr.killAll();

    expect(killed).toEqual(['a', 'b']);
  });
});

describe('PtyManager.attach/detach', () => {
  it('returns null for unknown session', () => {
    const { manager } = makeManager();
    expect(manager.attach(makeSessionId('nope'), 'conn', { cols: 80, rows: 24 })).toBeNull();
  });

  it('returns chunks and pid for active session', async () => {
    const terminalRepo = makeFakeTerminalRepo();
    terminalRepo.appendChunk(makeSessionId('sess-1'), 'Y2h1bms=', Date.now());

    const { manager } = makeManager({ terminalRepo });
    await Effect.runPromise(
      manager.spawn({
        sessionId: makeSessionId('sess-1'),
        command: 'claude',
        args: [],
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    const result = manager.attach(makeSessionId('sess-1'), 'conn-2', { cols: 100, rows: 30 });
    expect(result).not.toBeNull();
    expect(result!.pid).toBe(1234);
    expect(result!.chunks).toHaveLength(1);
  });
});

describe('PtyManager.trackConnection/getConnId/clearConnection', () => {
  it('tracks and retrieves prompt-mode connections', () => {
    const { manager } = makeManager();
    manager.trackConnection(makeSessionId('sess-1'), 'conn-1');
    expect(manager.getConnId(makeSessionId('sess-1'))).toBe('conn-1');
  });

  it('clears connection by connId', () => {
    const { manager } = makeManager();
    manager.trackConnection(makeSessionId('sess-1'), 'conn-1');
    manager.clearConnection('conn-1');
    expect(manager.getConnId(makeSessionId('sess-1'))).toBeUndefined();
  });
});

describe('PtyManager.handleDisconnect', () => {
  it('is a no-op for unknown connId', () => {
    const { manager, callbacks } = makeManager();
    expect(() => manager.handleDisconnect('unknown')).not.toThrow();
    expect(callbacks.exitedCalls).toHaveLength(0);
  });

  it('calls onProcessExited when no PTY entry exists', async () => {
    const { manager, callbacks } = makeManager();
    // Track a connection without spawning a PTY (prompt-mode)
    manager.trackConnection(makeSessionId('sess-1'), 'conn-1');
    manager.handleDisconnect('conn-1');
    expect(callbacks.exitedCalls).toHaveLength(1);
    expect(callbacks.exitedCalls[0].sessionId).toBe(makeSessionId('sess-1'));
    expect(callbacks.exitedCalls[0].exitCode).toBe(-1);
  });
});
