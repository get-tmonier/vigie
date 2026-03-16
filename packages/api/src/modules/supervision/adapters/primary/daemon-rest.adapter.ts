import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import type { AuthEnv } from '#modules/auth/adapters/primary/session-middleware';
import { clearEndedSessions } from '#modules/supervision/commands/clear-ended-sessions.command';
import { deleteSession } from '#modules/supervision/commands/delete-session.command';
import { executeCommand } from '#modules/supervision/commands/execute-command.command';
import { killAllSessions } from '#modules/supervision/commands/kill-all-sessions.command';
import { killSession } from '#modules/supervision/commands/kill-session.command';
import { listDirectory } from '#modules/supervision/commands/list-directory.command';
import { resumeSession } from '#modules/supervision/commands/resume-session.command';
import { spawnSession } from '#modules/supervision/commands/spawn-session.command';
import { DaemonReadRepository } from '#modules/supervision/ports/daemon-read-repository.port';
import { listDaemons } from '#modules/supervision/queries/list-daemons.query';
import { SupervisionLoggerLive } from '../logger';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';
import { daemonStore, sessionStore } from '../secondary/shared-state';
import { pendingFsRequests } from './daemon-ws.adapter';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive,
  SupervisionLoggerLive
);

const daemonRestApp = new Hono<AuthEnv>();

daemonRestApp.get('/daemons', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemons = await Effect.runPromise(Effect.provide(listDaemons(), allLayers));
  return c.json({ daemons: daemons.filter((d) => d.userId === user.id) });
});

daemonRestApp.post('/daemons/:daemonId/exec', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const body = await c.req.json<{ command: string; cwd?: string }>();

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(executeCommand(daemonId, body.command, body.cwd), {
        onSuccess: (r) => Effect.succeed({ ok: true, commandId: r.commandId } as const),
        onFailure: (e) =>
          Effect.succeed(
            e._tag === 'DaemonDisconnectedError'
              ? ({ ok: false, error: 'Daemon not connected', status: 503 } as const)
              : ({ ok: false, error: `Daemon not found: ${e.id}`, status: 404 } as const)
          ),
      }),
      allLayers
    )
  );

  if (!result.ok) {
    await Effect.runPromise(
      Effect.provide(
        Effect.annotateLogs(Effect.logWarning('Command dispatch failed'), { daemonId }),
        allLayers
      )
    );
    return c.json({ error: result.error }, result.status);
  }

  await Effect.runPromise(
    Effect.provide(
      Effect.annotateLogs(Effect.logInfo('Command dispatched'), {
        daemonId,
        commandId: result.commandId,
        command: body.command,
      }),
      allLayers
    )
  );

  return c.json({ commandId: result.commandId });
});

daemonRestApp.get('/daemons/:daemonId/sessions', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const sessions = Array.from(sessionStore.values()).filter((s) => s.daemonId === daemonId);
  return c.json({ sessions });
});

daemonRestApp.post('/daemons/:daemonId/sessions', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const body = await c.req.json<{
    agentType?: 'claude' | 'opencode' | 'generic';
    cwd?: string;
    cols?: number;
    rows?: number;
  }>();

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        spawnSession(
          daemonId,
          body.agentType ?? 'claude',
          body.cwd ?? '~',
          body.cols ?? 120,
          body.rows ?? 30
        ),
        {
          onSuccess: (r) => Effect.succeed({ ok: true, sessionId: r.sessionId } as const),
          onFailure: (e) =>
            Effect.succeed(
              e._tag === 'DaemonDisconnectedError'
                ? ({ ok: false, error: 'Daemon not connected', status: 503 } as const)
                : ({ ok: false, error: `Daemon not found: ${e.id}`, status: 404 } as const)
            ),
        }
      ),
      allLayers
    )
  );

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  await Effect.runPromise(
    Effect.provide(
      Effect.annotateLogs(Effect.logInfo('Session spawn requested'), {
        daemonId,
        sessionId: result.sessionId,
      }),
      allLayers
    )
  );

  return c.json({ sessionId: result.sessionId });
});

daemonRestApp.post('/daemons/:daemonId/sessions/:sessionId/kill', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const sessionId = c.req.param('sessionId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(killSession(daemonId, sessionId), {
        onSuccess: () => Effect.succeed({ ok: true } as const),
        onFailure: (e) =>
          Effect.succeed(
            e._tag === 'DaemonDisconnectedError'
              ? ({ ok: false, error: 'Daemon not connected', status: 503 } as const)
              : ({ ok: false, error: `Daemon not found: ${e.id}`, status: 404 } as const)
          ),
      }),
      allLayers
    )
  );

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  await Effect.runPromise(
    Effect.provide(
      Effect.annotateLogs(Effect.logInfo('Session kill requested'), { daemonId, sessionId }),
      allLayers
    )
  );

  return c.json({ ok: true });
});

daemonRestApp.post('/daemons/:daemonId/sessions/:sessionId/resume', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const sessionId = c.req.param('sessionId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const agentSession = sessionStore.get(sessionId);
  if (!agentSession) {
    return c.json({ error: 'Session not found' }, 404);
  }
  if (agentSession.status !== 'ended') {
    return c.json({ error: 'Session is not ended' }, 400);
  }
  if (!agentSession.resumable) {
    return c.json({ error: 'This session cannot be resumed' }, 400);
  }
  if (!agentSession.claudeSessionId) {
    return c.json({ error: 'No Claude session ID detected for this session' }, 400);
  }

  const body = await c.req
    .json<{ cols?: number; rows?: number }>()
    .catch(() => ({ cols: undefined, rows: undefined }));

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        resumeSession(
          daemonId,
          sessionId,
          agentSession.claudeSessionId,
          agentSession.cwd,
          body.cols ?? 120,
          body.rows ?? 30
        ),
        {
          onSuccess: (r) => Effect.succeed({ ok: true, sessionId: r.sessionId } as const),
          onFailure: (e) =>
            Effect.succeed(
              e._tag === 'DaemonDisconnectedError'
                ? ({ ok: false, error: 'Daemon not connected', status: 503 } as const)
                : ({ ok: false, error: `Daemon not found: ${e.id}`, status: 404 } as const)
            ),
        }
      ),
      allLayers
    )
  );

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json({ sessionId: result.sessionId });
});

daemonRestApp.delete('/daemons/:daemonId/sessions/:sessionId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const sessionId = c.req.param('sessionId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const result = await Effect.runPromise(
    Effect.matchEffect(deleteSession(sessionId), {
      onSuccess: () => Effect.succeed({ ok: true } as const),
      onFailure: (e) =>
        Effect.succeed(
          e._tag === 'SessionNotFoundError'
            ? ({ ok: false, error: `Session not found: ${e.id}`, status: 404 } as const)
            : ({ ok: false, error: `Session is still active: ${e.id}`, status: 400 } as const)
        ),
    })
  );

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  // Notify daemon to delete from SQLite
  const entry = daemonStore.get(daemonId);
  if (entry?.ws.readyState === WebSocket.OPEN) {
    entry.ws.send(JSON.stringify({ type: 'session:delete', sessionId }));
  }

  return c.json({ ok: true });
});

daemonRestApp.post('/daemons/:daemonId/sessions/clear-ended', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const { deletedCount } = await Effect.runPromise(clearEndedSessions(daemonId));

  // Notify daemon to clear ended sessions from SQLite
  const daemonEntry = daemonStore.get(daemonId);
  if (daemonEntry?.ws.readyState === WebSocket.OPEN) {
    daemonEntry.ws.send(JSON.stringify({ type: 'session:clear-ended' }));
  }

  await Effect.runPromise(
    Effect.provide(
      Effect.annotateLogs(Effect.logInfo('Cleared ended sessions'), { daemonId, deletedCount }),
      allLayers
    )
  );

  return c.json({ deletedCount });
});

daemonRestApp.post('/daemons/:daemonId/sessions/kill-all', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(killAllSessions(daemonId), {
        onSuccess: (r) => Effect.succeed({ ok: true, killedCount: r.killedCount } as const),
        onFailure: (e) =>
          Effect.succeed(
            e._tag === 'DaemonDisconnectedError'
              ? ({ ok: false, error: 'Daemon not connected', status: 503 } as const)
              : ({ ok: false, error: `Daemon not found: ${e.id}`, status: 404 } as const)
          ),
      }),
      allLayers
    )
  );

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  await Effect.runPromise(
    Effect.provide(
      Effect.annotateLogs(Effect.logInfo('Kill all sessions requested'), {
        daemonId,
        killedCount: result.killedCount,
      }),
      allLayers
    )
  );

  return c.json({ killedCount: result.killedCount });
});

daemonRestApp.post('/daemons/:daemonId/fs/list', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const body = await c.req.json<{ path: string }>();

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(listDirectory(daemonId, body.path ?? '~', pendingFsRequests), {
        onSuccess: (r) => Effect.succeed({ ok: true, entries: r.entries, error: r.error } as const),
        onFailure: (e) =>
          Effect.succeed(
            e._tag === 'DaemonDisconnectedError'
              ? ({ ok: false, entries: [], error: 'Daemon not connected', status: 503 } as const)
              : ({
                  ok: false,
                  entries: [],
                  error: `Daemon not found: ${e.id}`,
                  status: 404,
                } as const)
          ),
      }),
      allLayers
    )
  );

  if (!result.ok) {
    return c.json({ entries: result.entries, error: result.error }, result.status);
  }

  return c.json({ entries: result.entries, error: result.error });
});

export { daemonRestApp };
