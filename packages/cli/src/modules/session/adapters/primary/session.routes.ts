import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import * as v from 'valibot';
import type { createSessionStore } from '../../../daemon/persistence/session-store.js';
import type { EventBus } from '../../../terminal/event-bus.js';
import type { PtyEntry } from '../../../terminal/terminal.service.js';
import type { AgentSession } from '../../schemas.js';
import { SpawnSessionRequestSchema } from '../../schemas.js';

type SessionRouteDeps = {
  store: ReturnType<typeof createSessionStore>;
  ptyHandles: Map<string, PtyEntry>;
  eventBus: EventBus;
  spawnSession: (opts: {
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
  }) => Promise<{ sessionId: string }>;
  resumeSession: (
    sessionId: string,
    opts: { cols: number; rows: number }
  ) => Promise<{ sessionId: string }>;
};

type RouteError = HttpServerError.HttpServerError | Cause.UnknownError | never;

function mapRowToSession(
  row: ReturnType<ReturnType<typeof createSessionStore>['getAllSessions']>[number]
): AgentSession {
  return {
    id: row.id,
    agentType: row.agent_type,
    mode: row.mode,
    cwd: row.cwd,
    gitBranch: row.git_branch ?? undefined,
    repoName: row.repo_name ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    status: row.status as AgentSession['status'],
    exitCode: row.exit_code ?? undefined,
    claudeSessionId: row.claude_session_id ?? undefined,
    resumable: row.resumable === 1,
  };
}

const jsonRoute = <E>(
  method: 'GET' | 'POST' | 'DELETE',
  path: HttpRouter.PathInput,
  handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | HttpRouter.RouteContext
  >
) =>
  HttpRouter.route(
    method,
    path,
    handler.pipe(
      Effect.catch((err) =>
        Effect.succeed(
          HttpServerResponse.jsonUnsafe(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          )
        )
      )
    )
  );

export function createSessionRoutes(deps: SessionRouteDeps): HttpRouter.Route<RouteError, never>[] {
  return [
    HttpRouter.route(
      'GET',
      '/api/health',
      HttpServerResponse.jsonUnsafe({ status: 'ok', pid: process.pid })
    ),

    HttpRouter.route(
      'GET',
      '/api/sessions',
      Effect.sync(() => {
        const rows = deps.store.getAllSessions();
        return HttpServerResponse.jsonUnsafe({ sessions: rows.map(mapRowToSession) });
      })
    ),

    jsonRoute(
      'POST',
      '/api/sessions',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const raw = yield* request.json;
        const parsed = v.safeParse(SpawnSessionRequestSchema, raw);
        if (!parsed.success) {
          return HttpServerResponse.jsonUnsafe({ error: 'Invalid request body' }, { status: 400 });
        }
        const body = parsed.output;
        const result = yield* Effect.tryPromise(() =>
          deps.spawnSession({
            agentType: body.agentType ?? 'claude',
            cwd: body.cwd ?? '~',
            cols: body.cols ?? 120,
            rows: body.rows ?? 30,
          })
        );
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/:id/kill',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const entry = deps.ptyHandles.get(sessionId);
        if (!entry) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Session not found or not active' },
            { status: 404 }
          );
        }
        entry.handle.kill();
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    jsonRoute(
      'POST',
      '/api/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const session = deps.store.getSessionById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (session.status !== 'ended') {
          return HttpServerResponse.jsonUnsafe({ error: 'Session is not ended' }, { status: 400 });
        }
        if (!session.resumable) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'This session cannot be resumed' },
            { status: 400 }
          );
        }
        if (!session.claude_session_id) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'No Claude session ID detected' },
            { status: 400 }
          );
        }

        let cols = 120;
        let rows = 30;
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* Effect.gen(function* () {
          const body = (yield* request.json) as { cols?: number; rows?: number };
          if (typeof body.cols === 'number') cols = body.cols;
          if (typeof body.rows === 'number') rows = body.rows;
        }).pipe(Effect.catch(() => Effect.void));

        const result = yield* Effect.tryPromise(() =>
          deps.resumeSession(sessionId, { cols, rows })
        );
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    ),

    HttpRouter.route(
      'DELETE',
      '/api/sessions/:id',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const session = deps.store.getSessionById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (session.status === 'active') {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Cannot delete an active session' },
            { status: 400 }
          );
        }
        deps.store.deleteSessionById(sessionId);
        deps.eventBus.publish({ type: 'session:deleted', sessionId, timestamp: Date.now() });
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/clear-ended',
      Effect.sync(() => {
        deps.store.deleteEndedSessions();
        deps.eventBus.publish({ type: 'sessions:cleared', timestamp: Date.now() });
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/kill-all',
      Effect.sync(() => {
        let killedCount = 0;
        for (const [sessionId, entry] of deps.ptyHandles) {
          entry.handle.kill();
          killedCount++;
          console.log(`[server] Kill requested for session ${sessionId}`);
        }
        return HttpServerResponse.jsonUnsafe({ killedCount });
      })
    ),
  ];
}
