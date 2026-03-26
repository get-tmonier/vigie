import type { Socket } from 'bun';
import { Effect } from 'effect';
import * as v from 'valibot';
import { type DaemonToSession, DaemonToSessionSchema } from '#schemas/ipc-messages.js';
import { IpcConnectionError } from '../domain/errors.js';
import type { IpcClientShape } from '../ports/ipc-client.port.js';

export function createUnixSocketClient(): IpcClientShape {
  let socket: Socket<unknown> | null = null;
  let buffer = '';
  const messageHandlers: Array<(msg: DaemonToSession) => void> = [];
  const closeHandlers: Array<() => void> = [];

  return {
    connect: (socketPath) =>
      Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

            Bun.connect({
              unix: socketPath,
              socket: {
                open(s) {
                  socket = s;
                  clearTimeout(timeout);
                  resolve();
                },
                data(_s, raw) {
                  buffer += typeof raw === 'string' ? raw : new TextDecoder().decode(raw);

                  for (
                    let newlineIdx = buffer.indexOf('\n');
                    newlineIdx !== -1;
                    newlineIdx = buffer.indexOf('\n')
                  ) {
                    const line = buffer.slice(0, newlineIdx).trim();
                    buffer = buffer.slice(newlineIdx + 1);

                    if (!line) continue;

                    let parsed: unknown;
                    try {
                      parsed = JSON.parse(line);
                    } catch {
                      continue;
                    }

                    const result = v.safeParse(DaemonToSessionSchema, parsed);
                    if (!result.success) continue;

                    for (const handler of messageHandlers) {
                      handler(result.output);
                    }
                  }
                },
                close() {
                  socket = null;
                  for (const handler of closeHandlers) {
                    handler();
                  }
                },
                error(_s, err) {
                  console.error('[ipc-client] Socket error:', err.message);
                },
              },
            }).catch(reject);
          }),
        catch: (err) =>
          new IpcConnectionError({
            message: `Failed to connect to daemon: ${err instanceof Error ? err.message : String(err)}`,
          }),
      }),

    send: (msg) =>
      Effect.try({
        try: () => {
          if (!socket) throw new Error('Not connected');
          socket.write(`${JSON.stringify(msg)}\n`);
        },
        catch: (err) =>
          new IpcConnectionError({
            message: `Failed to send IPC message: ${err instanceof Error ? err.message : String(err)}`,
          }),
      }),

    waitForMessage: (type) =>
      Effect.tryPromise({
        try: () =>
          new Promise<DaemonToSession>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('Timeout waiting for message')),
              10000
            );
            const handler = (msg: DaemonToSession) => {
              if (msg.type === type) {
                clearTimeout(timeout);
                const idx = messageHandlers.indexOf(handler);
                if (idx !== -1) messageHandlers.splice(idx, 1);
                resolve(msg);
              }
            };
            messageHandlers.push(handler);
          }),
        catch: (err) =>
          new IpcConnectionError({
            message: `Timeout waiting for ${type}: ${err instanceof Error ? err.message : String(err)}`,
          }),
      }) as Effect.Effect<Extract<DaemonToSession, { type: typeof type }>, IpcConnectionError>,

    onMessage: (handler) => {
      messageHandlers.push(handler);
    },

    onClose: (handler) => {
      closeHandlers.push(handler);
    },

    close: () =>
      Effect.sync(() => {
        if (socket) {
          socket.terminate();
          socket = null;
        }
        messageHandlers.length = 0;
      }),
  };
}
