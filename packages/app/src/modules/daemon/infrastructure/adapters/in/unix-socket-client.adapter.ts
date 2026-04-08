import type { Socket } from 'bun';
import { Deferred, Duration, Effect, Exit } from 'effect';
import * as v from 'valibot';
import type { IpcClientShape } from '#modules/daemon/application/ports/in/ipc-client.port';
import { IpcConnectionError } from '#shared/kernel/errors';
import { type DaemonToSession, DaemonToSessionSchema } from '#shared/kernel/ipc-protocol';

export function createUnixSocketClient(): IpcClientShape {
  let socket: Socket<unknown> | null = null;
  let buffer = '';
  const messageHandlers: Array<(msg: DaemonToSession) => void> = [];
  const closeHandlers: Array<() => void> = [];

  return {
    connect: (socketPath) =>
      Effect.callback<void, IpcConnectionError>((resume) => {
        Bun.connect({
          unix: socketPath,
          socket: {
            open(s) {
              socket = s;
              resume(Exit.succeed(undefined));
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
              Effect.runFork(Effect.logError(`[ipc-client] Socket error: ${err.message}`));
            },
          },
        }).catch((err) =>
          resume(
            Exit.fail(
              new IpcConnectionError({
                message: `Failed to connect to daemon: ${err instanceof Error ? err.message : String(err)}`,
              })
            )
          )
        );
      }).pipe(
        Effect.timeout(Duration.seconds(5)),
        Effect.mapError((err) =>
          err._tag === 'TimeoutError'
            ? new IpcConnectionError({ message: 'Connection timeout' })
            : err
        )
      ),

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
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<DaemonToSession>();
        const services = yield* Effect.services();
        const handler = (msg: DaemonToSession) => {
          if (msg.type === type) {
            const idx = messageHandlers.indexOf(handler);
            if (idx !== -1) messageHandlers.splice(idx, 1);
            Effect.runForkWith(services)(Deferred.succeed(deferred, msg));
          }
        };
        messageHandlers.push(handler);
        return yield* Deferred.await(deferred);
      }).pipe(
        Effect.timeout(Duration.seconds(10)),
        Effect.mapError((err) =>
          err._tag === 'TimeoutError'
            ? new IpcConnectionError({ message: `Timeout waiting for ${type}` })
            : err
        )
      ) as Effect.Effect<Extract<DaemonToSession, { type: typeof type }>, IpcConnectionError>,

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
