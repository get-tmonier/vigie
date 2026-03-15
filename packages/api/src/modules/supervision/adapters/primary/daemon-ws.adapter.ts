import type { FsListDirResponse } from '@tmonier/shared';
import { UpstreamMessageSchema } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import * as v from 'valibot';
import {
  type DaemonAuthEnv,
  daemonAuthMiddleware,
} from '#modules/auth/adapters/primary/daemon-auth.middleware';
import { registerDaemon } from '#modules/supervision/commands/register-daemon.command';
import { unregisterDaemon } from '#modules/supervision/commands/unregister-daemon.command';
import {
  createAgentSession,
  createAgentSessionFromSync,
} from '#modules/supervision/domain/agent-session';
import type { DaemonSession } from '#modules/supervision/domain/daemon-session';
import { EventPublisher } from '#modules/supervision/ports/event-publisher.port';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';
import { SupervisionLoggerLive } from '../logger';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';
import { InMemoryTerminalRelayLive } from '../secondary/in-memory-terminal-relay';
import { daemonStore, sessionStore, sessionToDaemon } from '../secondary/shared-state';

// Pending fs:list-dir requests — keyed by requestId, resolved when daemon responds
export const pendingFsRequests = new Map<
  string,
  { resolve: (response: FsListDirResponse) => void; timer: ReturnType<typeof setTimeout> }
>();

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive,
  InMemoryTerminalRelayLive,
  SupervisionLoggerLive
);

const daemonWsApp = new Hono<DaemonAuthEnv>();

const sessionByWs = new WeakMap<object, DaemonSession>();

daemonWsApp.get(
  '/ws/daemon',
  daemonAuthMiddleware,
  upgradeWebSocket((c) => {
    const userId = (c as unknown as { get(key: 'daemonUserId'): string }).get('daemonUserId');

    return {
      onMessage: async (event, ws) => {
        const raw = ws.raw;
        if (!raw) return;

        const data = typeof event.data === 'string' ? event.data : String(event.data);
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          await Effect.runPromise(Effect.provide(Effect.logWarning('WS: invalid JSON'), allLayers));
          return;
        }

        const result = v.safeParse(UpstreamMessageSchema, parsed);
        if (!result.success) {
          await Effect.runPromise(
            Effect.provide(Effect.logWarning('WS: schema validation failed'), allLayers)
          );
          return;
        }

        const msg = result.output;

        switch (msg.type) {
          case 'daemon:hello': {
            const session = await Effect.runPromise(
              Effect.provide(registerDaemon(msg, raw as unknown as WebSocket, userId), allLayers)
            );
            sessionByWs.set(raw, session);
            await Effect.runPromise(
              Effect.provide(
                Effect.annotateLogs(Effect.logInfo('Daemon registered'), {
                  daemonId: session.id,
                  hostname: msg.hostname,
                  userId,
                }),
                allLayers
              )
            );
            break;
          }
          case 'command:output':
          case 'command:done':
          case 'command:error': {
            const session = sessionByWs.get(raw);
            if (session) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, msg);
                    yield* Effect.annotateLogs(Effect.logDebug('WS: event relayed'), {
                      daemonId: session.id,
                      eventType: msg.type,
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'pong': {
            const session = sessionByWs.get(raw);
            if (session) {
              const entry = daemonStore.get(session.id);
              if (entry) {
                entry.lastPongAt = Date.now();
              }
            }
            break;
          }
          case 'session:started': {
            const session = sessionByWs.get(raw);
            if (session) {
              const agentSession = createAgentSession(session.id, msg);
              sessionStore.set(msg.sessionId, agentSession);
              sessionToDaemon.set(msg.sessionId, session.id);
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const relay = yield* Effect.service(TerminalRelay);
                    yield* relay.create(msg.sessionId);
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'session:started',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      agentType: msg.agentType,
                      mode: msg.mode ?? 'prompt',
                      cwd: msg.cwd,
                      gitBranch: msg.gitBranch,
                      repoName: msg.repoName,
                      timestamp: msg.timestamp,
                    });
                    yield* Effect.annotateLogs(Effect.logInfo('Session started'), {
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      agentType: msg.agentType,
                      mode: msg.mode ?? 'prompt',
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'session:output': {
            const session = sessionByWs.get(raw);
            if (session) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'session:output',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      data: msg.data,
                      chunkType: msg.chunkType,
                      timestamp: msg.timestamp,
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'session:ended': {
            const session = sessionByWs.get(raw);
            if (session) {
              const agentSession = sessionStore.get(msg.sessionId);
              if (agentSession) {
                sessionStore.set(msg.sessionId, { ...agentSession, status: 'ended' });
              }
              sessionToDaemon.delete(msg.sessionId);
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const relay = yield* Effect.service(TerminalRelay);
                    yield* relay.destroy(msg.sessionId);
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'session:ended',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      exitCode: msg.exitCode,
                      timestamp: msg.timestamp,
                    });
                    yield* Effect.annotateLogs(Effect.logInfo('Session ended'), {
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      exitCode: String(msg.exitCode),
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'terminal:output': {
            const session = sessionByWs.get(raw);
            if (session) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const relay = yield* Effect.service(TerminalRelay);
                    yield* Effect.logDebug(
                      `[API] terminal:output received, sessionId=${msg.sessionId}, bytes=${msg.data.length}`
                    );
                    yield* relay.write(msg.sessionId, msg.data);
                  }),
                  allLayers
                )
              );
            } else {
              await Effect.runPromise(
                Effect.provide(
                  Effect.logWarning('terminal:output: no daemon session found for WS'),
                  allLayers
                )
              );
            }
            break;
          }
          case 'session:spawn-failed': {
            const session = sessionByWs.get(raw);
            if (session) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'session:spawn-failed',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      error: msg.error,
                      timestamp: msg.timestamp,
                    });
                    yield* Effect.annotateLogs(Effect.logWarning('Session spawn failed'), {
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      error: msg.error,
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'fs:list-dir-response': {
            const pending = pendingFsRequests.get(msg.requestId);
            if (pending) {
              clearTimeout(pending.timer);
              pendingFsRequests.delete(msg.requestId);
              pending.resolve(msg);
            }
            break;
          }
          case 'session:error': {
            const session = sessionByWs.get(raw);
            if (session) {
              const agentSession = sessionStore.get(msg.sessionId);
              if (agentSession) {
                sessionStore.set(msg.sessionId, { ...agentSession, status: 'ended' });
              }
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const relay = yield* Effect.service(TerminalRelay);
                    yield* relay.destroy(msg.sessionId);
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'session:error',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      error: msg.error,
                      timestamp: msg.timestamp,
                    });
                    yield* Effect.annotateLogs(Effect.logWarning('Session error'), {
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      error: msg.error,
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'terminal:input-echo': {
            const session = sessionByWs.get(raw);
            if (session) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'terminal:input-echo',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      text: msg.text,
                      source: msg.source,
                      timestamp: msg.timestamp,
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'session:claude-id-detected': {
            const session = sessionByWs.get(raw);
            if (session) {
              const agentSession = sessionStore.get(msg.sessionId);
              if (agentSession) {
                sessionStore.set(msg.sessionId, {
                  ...agentSession,
                  claudeSessionId: msg.claudeSessionId,
                });
              }
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const publisher = yield* Effect.service(EventPublisher);
                    yield* publisher.publish(session.id, {
                      type: 'session:claude-id-detected',
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      claudeSessionId: msg.claudeSessionId,
                      timestamp: msg.timestamp,
                    });
                    yield* Effect.annotateLogs(Effect.logInfo('Claude session ID detected'), {
                      daemonId: session.id,
                      sessionId: msg.sessionId,
                      claudeSessionId: msg.claudeSessionId,
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
          case 'daemon:sync': {
            const session = sessionByWs.get(raw);
            if (session) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const relay = yield* Effect.service(TerminalRelay);
                    const publisher = yield* Effect.service(EventPublisher);

                    for (const syncSession of msg.sessions) {
                      const agentSession = createAgentSessionFromSync(session.id, syncSession);
                      sessionStore.set(syncSession.sessionId, agentSession);
                      sessionToDaemon.set(syncSession.sessionId, session.id);

                      yield* relay.create(syncSession.sessionId);

                      // Populate terminal buffer with synced chunks (sorted by seq)
                      const sortedChunks = [...syncSession.terminalChunks].sort(
                        (a, b) => a.seq - b.seq
                      );
                      for (const chunk of sortedChunks) {
                        yield* relay.write(syncSession.sessionId, chunk.data);
                      }

                      // Notify browser via SSE so dashboard recovers
                      yield* publisher.publish(session.id, {
                        type: 'session:started',
                        daemonId: session.id,
                        sessionId: syncSession.sessionId,
                        agentType: syncSession.agentType,
                        mode: syncSession.mode ?? 'prompt',
                        cwd: syncSession.cwd,
                        gitBranch: syncSession.gitBranch,
                        repoName: syncSession.repoName,
                        timestamp: syncSession.startedAt,
                      });

                      // Replay input history from sync
                      if (syncSession.inputHistory) {
                        for (const entry of syncSession.inputHistory) {
                          yield* publisher.publish(session.id, {
                            type: 'terminal:input-echo',
                            daemonId: session.id,
                            sessionId: syncSession.sessionId,
                            text: entry.text,
                            source: entry.source as 'cli' | 'browser',
                            timestamp: entry.timestamp,
                          });
                        }
                      }

                      // If session already ended, also publish the ended event
                      if (syncSession.status === 'ended' || syncSession.status === 'error') {
                        yield* publisher.publish(session.id, {
                          type: 'session:ended',
                          daemonId: session.id,
                          sessionId: syncSession.sessionId,
                          exitCode: syncSession.exitCode ?? 0,
                          timestamp: Date.now(),
                        });
                      }
                    }

                    yield* Effect.annotateLogs(Effect.logInfo('Daemon sync completed'), {
                      daemonId: session.id,
                      sessionCount: String(msg.sessions.length),
                    });
                  }),
                  allLayers
                )
              );
            }
            break;
          }
        }
      },
      onClose: async (_event, ws) => {
        const raw = ws.raw;
        if (!raw) return;
        const session = sessionByWs.get(raw);
        if (session) {
          // Destroy terminal buffers for all sessions owned by this daemon
          for (const [sessionId, daemonId] of sessionToDaemon.entries()) {
            if (daemonId === session.id) {
              await Effect.runPromise(
                Effect.provide(
                  Effect.gen(function* () {
                    const relay = yield* Effect.service(TerminalRelay);
                    yield* relay.destroy(sessionId);
                  }),
                  allLayers
                )
              );
            }
          }
          await Effect.runPromise(
            Effect.provide(
              Effect.gen(function* () {
                yield* unregisterDaemon(session.id);
                yield* Effect.annotateLogs(Effect.logInfo('Daemon unregistered'), {
                  daemonId: session.id,
                });
              }),
              allLayers
            )
          ).catch(async (error) => {
            await Effect.runPromise(
              Effect.provide(
                Effect.annotateLogs(Effect.logError('Daemon unregister failed'), {
                  daemonId: session.id,
                  error: String(error),
                }),
                allLayers
              )
            );
          });
          sessionByWs.delete(raw);
        }
      },
    };
  })
);

export { daemonWsApp, websocket };
