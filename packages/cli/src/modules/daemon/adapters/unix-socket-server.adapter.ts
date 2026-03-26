import { Effect } from 'effect';
import * as v from 'valibot';
import { SessionToDaemonSchema } from '#schemas/ipc-messages.js';
import type { IpcConnection, IpcServerShape } from '../ports/ipc-server.port.js';

interface ConnectionState {
  readonly id: string;
  buffer: string;
  socket: { write(data: string | Uint8Array): number; end(): void };
}

export function createUnixSocketServer(): IpcServerShape {
  const connections = new Map<string, ConnectionState>();
  let server: ReturnType<typeof Bun.listen> | null = null;

  return {
    start: (socketPath, onMessage, onDisconnect) =>
      Effect.sync(() => {
        let connCounter = 0;
        const connIdMap = new WeakMap<object, string>();

        server = Bun.listen({
          unix: socketPath,
          socket: {
            open(socket) {
              const connId = `conn-${++connCounter}`;
              connIdMap.set(socket, connId);
              connections.set(connId, {
                id: connId,
                buffer: '',
                socket,
              });
            },
            data(socket, raw) {
              const connId = connIdMap.get(socket);
              if (!connId) return;
              const state = connections.get(connId);
              if (!state) return;

              state.buffer += typeof raw === 'string' ? raw : new TextDecoder().decode(raw);

              for (
                let newlineIdx = state.buffer.indexOf('\n');
                newlineIdx !== -1;
                newlineIdx = state.buffer.indexOf('\n')
              ) {
                const line = state.buffer.slice(0, newlineIdx).trim();
                state.buffer = state.buffer.slice(newlineIdx + 1);

                if (!line) continue;

                let parsed: unknown;
                try {
                  parsed = JSON.parse(line);
                } catch {
                  continue;
                }

                const result = v.safeParse(SessionToDaemonSchema, parsed);
                if (!result.success) continue;

                const conn: IpcConnection = {
                  id: connId,
                  send: (data: string) => socket.write(`${data}\n`),
                  close: () => socket.end(),
                };

                Effect.runFork(onMessage(conn, result.output));
              }
            },
            close(socket) {
              const connId = connIdMap.get(socket);
              if (!connId) return;
              connections.delete(connId);
              Effect.runFork(onDisconnect(connId));
            },
            error(_socket, err) {
              console.error('[ipc-server] Socket error:', err.message);
            },
          },
        });
      }),

    sendTo: (connId, data) =>
      Effect.sync(() => {
        const state = connections.get(connId);
        if (state) {
          state.socket.write(`${data}\n`);
        }
      }),

    shutdown: () =>
      Effect.sync(() => {
        if (server) {
          server.stop();
          server = null;
        }
        connections.clear();
      }),
  };
}
