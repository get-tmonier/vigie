import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Effect } from 'effect';
import { attachPtyRelay } from '../modules/session/adapters/pty-relay.js';
import type { IpcClientShape } from '../modules/session/ports/ipc-client.port.js';

function createMockClient(): IpcClientShape {
  return {
    connect: () => Effect.void,
    send: () => Effect.void,
    waitForMessage: () => Effect.never as never,
    onMessage: () => {},
    onClose: () => {},
    close: () => Effect.void,
  };
}

describe('pty-relay: signal handlers', () => {
  let exitSpy: ReturnType<typeof spyOn<NodeJS.Process, 'exit'>>;
  let stdoutWrites: string[];
  let originalWrite: typeof process.stdout.write;
  let originalConnect: typeof Bun.connect;

  beforeEach(() => {
    exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never);

    stdoutWrites = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((data: string | Uint8Array, ..._rest: unknown[]) => {
      stdoutWrites.push(typeof data === 'string' ? data : new TextDecoder().decode(data));
      return true;
    }) as typeof process.stdout.write;

    originalConnect = Bun.connect;
    // Never resolves: keeps the Effect pending so we can test signal handlers
    (Bun as Record<string, unknown>).connect = () => new Promise(() => {});
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    (Bun as Record<string, unknown>).connect = originalConnect;
    exitSpy.mockRestore();
    // Safety net: remove leftover handlers in tests that don't consume them
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  async function startRelay(): Promise<void> {
    Effect.runPromise(
      attachPtyRelay(createMockClient(), {
        sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      })
    ).catch(() => {});
    // Let the synchronous part of the Effect fiber run (up to first async op)
    await Promise.resolve();
  }

  function getHandler(signal: 'SIGINT' | 'SIGTERM'): (() => void) | undefined {
    // rawListeners returns the once-wrapper, calling it removes + invokes the original
    return process.rawListeners(signal).at(-1) as (() => void) | undefined;
  }

  it('registers SIGINT and SIGTERM handlers when relay starts', async () => {
    const sigintBefore = process.listenerCount('SIGINT');
    const sigtermBefore = process.listenerCount('SIGTERM');

    await startRelay();

    expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1);
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore + 1);
  });

  it('exits with code 130 and exits alt screen on SIGINT', async () => {
    await startRelay();

    getHandler('SIGINT')?.();

    expect(exitSpy).toHaveBeenCalledWith(130);
    // renderer.deactivate() writes exitAltScreen (\x1b[?1049l) to stdout
    expect(stdoutWrites.some((w) => w.includes('\x1b[?1049l'))).toBe(true);
  });

  it('exits with code 143 and exits alt screen on SIGTERM', async () => {
    await startRelay();

    getHandler('SIGTERM')?.();

    expect(exitSpy).toHaveBeenCalledWith(143);
    expect(stdoutWrites.some((w) => w.includes('\x1b[?1049l'))).toBe(true);
  });

  it('SIGINT handler fires only once (process.once semantics)', async () => {
    await startRelay();

    process.emit('SIGINT');
    process.emit('SIGINT'); // second emit should not re-trigger

    expect(exitSpy).toHaveBeenCalledTimes(1);
  });
});
