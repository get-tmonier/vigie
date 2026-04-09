import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import * as v from 'valibot';
import type { SessionCleanupShape } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { SpawnSessionShape } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import { SpawnSessionRequestSchema } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { sessionToDTO } from '#modules/agent-session/infrastructure/adapters/in/session.mapper';
import type { PtyManagerShape } from '#modules/agent-session/infrastructure/pty-manager.types';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { expandPath } from '#shared/lib/path';

type SessionApiRouteDeps = {
  spawnSession: SpawnSessionShape;
  sessionCleanup: SessionCleanupShape;
  sessionQueries: SessionQueriesShape;
  ptyManager: PtyManagerShape;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

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
      Effect.catch((err) => {
        if (err instanceof Error) {
          const tag = (err as { _tag?: string })._tag;
          if (tag === 'SessionNotFoundError') {
            return Effect.succeed(
              HttpServerResponse.jsonUnsafe({ error: err.message }, { status: 404 })
            );
          }
          if (tag === 'CannotResumeSessionError') {
            return Effect.succeed(
              HttpServerResponse.jsonUnsafe({ error: err.message }, { status: 409 })
            );
          }
        }
        return Effect.succeed(
          HttpServerResponse.jsonUnsafe(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          )
        );
      })
    )
  );

export function createSessionApiRoutes(
  deps: SessionApiRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  const { spawnSession, sessionCleanup, sessionQueries, ptyManager } = deps;

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
        const sessions = sessionQueries.listAll().map(sessionToDTO);
        return HttpServerResponse.jsonUnsafe({ sessions });
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
        const result = yield* spawnSession.spawnInteractive({
          agentType: body.agentType ?? 'claude',
          cwd: expandPath(body.cwd ?? '~'),
          cols: body.cols ?? 120,
          rows: body.rows ?? 30,
        });
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/:id/kill',
      Effect.gen(function* () {
        const { id: rawSessionId } = yield* HttpRouter.params;
        if (!rawSessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const sessionId = makeSessionId(rawSessionId);
        const pid = ptyManager.getActivePid(sessionId);
        if (pid === null) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Session not found or not active' },
            { status: 404 }
          );
        }
        ptyManager.kill(sessionId);
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    jsonRoute(
      'POST',
      '/api/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: rawSessionId } = yield* HttpRouter.params;
        if (!rawSessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const sessionId = makeSessionId(rawSessionId);
        const session = sessionQueries.findById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (!session.canResume) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'This session cannot be resumed' },
            { status: 409 }
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

        const result = yield* spawnSession.resume(sessionId, { cols, rows });
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    ),

    HttpRouter.route(
      'DELETE',
      '/api/sessions/:id',
      Effect.gen(function* () {
        const { id: rawSessionId } = yield* HttpRouter.params;
        if (!rawSessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const sessionId = makeSessionId(rawSessionId);
        const session = sessionQueries.findById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (!session.canDelete) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Cannot delete an active session' },
            { status: 409 }
          );
        }
        sessionCleanup.delete(sessionId);
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/clear-ended',
      Effect.sync(() => {
        sessionCleanup.deleteAllEnded();
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/kill-all',
      Effect.sync(() => {
        ptyManager.killAll();
        return HttpServerResponse.jsonUnsafe({ killedCount: -1 });
      })
    ),
  ];
}
