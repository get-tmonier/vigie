import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import type { AuthEnv } from '#modules/auth/adapters/primary/session-middleware';
import { sessionMiddleware } from '#modules/auth/adapters/primary/session-middleware';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';
import { SupervisionLoggerLive } from '../logger';
import { InMemoryTerminalRelayLive } from '../secondary/in-memory-terminal-relay';
import { daemonStore, sessionStore, sessionToDaemon } from '../secondary/shared-state';

const allLayers = Layer.mergeAll(InMemoryTerminalRelayLive, SupervisionLoggerLive);

function sendResizeToDaemon(
  daemonWs: WebSocket,
  sessionId: string,
  cols: number,
  rows: number
): void {
  daemonWs.send(JSON.stringify({ type: 'terminal:resize', sessionId, cols, rows }));
}

const terminalWsApp = new Hono<AuthEnv>();

terminalWsApp.get(
  '/ws/terminal/:sessionId',
  sessionMiddleware,
  upgradeWebSocket((c) => {
    const user = (c as unknown as { get(key: 'user'): { id: string } | null }).get('user');
    const sessionId = c.req.param('sessionId');

    return {
      onOpen: async (_event, ws) => {
        await Effect.runPromise(
          Effect.provide(
            Effect.annotateLogs(Effect.logInfo('Terminal WS: onOpen'), {
              sessionId,
              userId: user?.id ?? 'null',
            }),
            allLayers
          )
        );
        if (!user) {
          await Effect.runPromise(
            Effect.provide(Effect.logWarning('Terminal WS: closing unauthorized'), allLayers)
          );
          ws.close(4001, 'Unauthorized');
          return;
        }

        const agentSession = sessionStore.get(sessionId);
        if (!agentSession) {
          await Effect.runPromise(
            Effect.provide(
              Effect.annotateLogs(Effect.logWarning('Terminal WS: session not found'), {
                sessionId,
                availableSessions: [...sessionStore.keys()].join(', '),
              }),
              allLayers
            )
          );
          ws.close(4004, 'Session not found');
          return;
        }

        const daemonId = sessionToDaemon.get(sessionId);
        if (!daemonId) {
          await Effect.runPromise(
            Effect.provide(
              Effect.annotateLogs(Effect.logWarning('Terminal WS: daemon not found for session'), {
                sessionId,
              }),
              allLayers
            )
          );
          ws.close(4004, 'Daemon not found for session');
          return;
        }

        const daemonEntry = daemonStore.get(daemonId);
        if (!daemonEntry || daemonEntry.session.userId !== user.id) {
          await Effect.runPromise(
            Effect.provide(
              Effect.annotateLogs(Effect.logWarning('Terminal WS: forbidden'), {
                sessionId,
                daemonExists: String(!!daemonEntry),
                daemonUserId: daemonEntry?.session.userId ?? 'none',
                requestUserId: user.id,
              }),
              allLayers
            )
          );
          ws.close(4003, 'Forbidden');
          return;
        }

        // Subscribe to relay — replays buffered output, then streams live
        const unsubscribe = await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const relay = yield* Effect.service(TerminalRelay);
              const sendChunk = (data: string) => {
                const rawWs = ws.raw;
                if (rawWs && (rawWs as WebSocket).readyState === WebSocket.OPEN) {
                  const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
                  ws.send(payload);
                }
              };
              const unsub = yield* relay.subscribe(sessionId, sendChunk);
              yield* Effect.annotateLogs(
                Effect.logInfo('Terminal WS: browser connected (replay + live)'),
                {
                  sessionId,
                  userId: user.id,
                }
              );
              return unsub;
            }),
            allLayers
          )
        );

        const raw = ws.raw;
        if (raw) {
          (raw as unknown as Record<string, unknown>).__terminalUnsub = unsubscribe;
        }
      },

      onMessage: async (event, _ws) => {
        const daemonId = sessionToDaemon.get(sessionId);
        if (!daemonId) return;

        const daemonEntry = daemonStore.get(daemonId);
        if (!daemonEntry || daemonEntry.ws.readyState !== WebSocket.OPEN) return;

        if (typeof event.data === 'string') {
          let parsed: unknown;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            return;
          }
          const msg = parsed as { type: string; cols?: number; rows?: number };
          if (
            msg.type === 'resize' &&
            typeof msg.cols === 'number' &&
            typeof msg.rows === 'number'
          ) {
            // Forward resize to daemon → CLI → PTY (triggers SIGWINCH → Ink re-render)
            sendResizeToDaemon(daemonEntry.ws, sessionId, msg.cols, msg.rows);
            await Effect.runPromise(
              Effect.provide(
                Effect.annotateLogs(Effect.logInfo('Terminal WS: resize forwarded to daemon'), {
                  sessionId,
                  cols: String(msg.cols),
                  rows: String(msg.rows),
                }),
                allLayers
              )
            );
          }
        } else {
          let bytes: Uint8Array | null = null;

          if (event.data instanceof Uint8Array) {
            bytes = event.data;
          } else if (event.data instanceof ArrayBuffer) {
            bytes = new Uint8Array(event.data);
          } else if (typeof (event.data as Blob).arrayBuffer === 'function') {
            bytes = new Uint8Array(await (event.data as Blob).arrayBuffer());
          }

          if (bytes && bytes.length > 0) {
            const base64 = Buffer.from(bytes).toString('base64');
            daemonEntry.ws.send(
              JSON.stringify({
                type: 'terminal:input',
                sessionId,
                data: base64,
              })
            );
          }
        }
      },

      onClose: async (_event, ws) => {
        const raw = ws.raw;
        if (raw) {
          const unsub = (raw as unknown as Record<string, unknown>).__terminalUnsub as
            | (() => void)
            | undefined;
          unsub?.();
        }

        const daemonId = sessionToDaemon.get(sessionId);
        if (daemonId) {
          const daemonEntry = daemonStore.get(daemonId);
          if (daemonEntry?.ws.readyState === WebSocket.OPEN) {
            daemonEntry.ws.send(
              JSON.stringify({
                type: 'terminal:browser-disconnected',
                sessionId,
              })
            );
          }
        }

        await Effect.runPromise(
          Effect.provide(
            Effect.annotateLogs(Effect.logInfo('Terminal WS: browser disconnected'), { sessionId }),
            allLayers
          )
        );
      },
    };
  })
);

export { terminalWsApp };
