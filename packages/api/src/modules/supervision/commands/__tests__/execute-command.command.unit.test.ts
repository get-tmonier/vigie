import { describe, expect, it } from 'bun:test';
import { Effect, Exit, Layer } from 'effect';
import { DaemonWriteRepository } from '#modules/supervision/ports/daemon-write-repository.port';
import { executeCommand } from '../execute-command.command';

describe('executeCommand', () => {
  it('creates a command and sends it over WS', async () => {
    const sentMessages: string[] = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sentMessages.push(data);
      },
    } as unknown as WebSocket;

    const testLayers = Layer.succeed(DaemonWriteRepository, {
      register: () => Effect.die('not implemented'),
      unregister: () => Effect.void,
      getWs: () => Effect.succeed(mockWs),
    });

    const result = await Effect.runPromise(
      Effect.provide(executeCommand('daemon-1', 'echo hello', '/tmp'), testLayers)
    );

    expect(result.commandId).toBeString();
    expect(sentMessages).toHaveLength(1);

    const parsed = JSON.parse(sentMessages[0]);
    expect(parsed.type).toBe('command:request');
    expect(parsed.id).toBe(result.commandId);
    expect(parsed.command).toBe('echo hello');
    expect(parsed.cwd).toBe('/tmp');
  });

  it('fails with DaemonDisconnectedError when WS is not open', async () => {
    const mockWs = {
      readyState: WebSocket.CLOSED,
      send: () => {},
    } as unknown as WebSocket;

    const testLayers = Layer.succeed(DaemonWriteRepository, {
      register: () => Effect.die('not implemented'),
      unregister: () => Effect.void,
      getWs: () => Effect.succeed(mockWs),
    });

    const exit = await Effect.runPromiseExit(
      Effect.provide(executeCommand('daemon-1', 'echo hello'), testLayers)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain('DaemonDisconnectedError');
    }
  });
});
