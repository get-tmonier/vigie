import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import * as Schema from 'effect/Schema';

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import * as v from 'valibot';
import { renderPage } from '#infra/ssr/render-page';
import type { SessionCleanupShape } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { SpawnSessionShape } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import type { TerminalConnectionShape } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { SpawnSessionRequestSchema } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { expandPath } from '#shared/lib/path';
import { DashboardPage } from './dashboard.view';
import { sessionToDTO } from './session.mapper';

type SessionRouteDeps = {
  spawnSession: SpawnSessionShape;
  sessionCleanup: SessionCleanupShape;
  sessionQueries: SessionQueriesShape;
  terminalConnection: TerminalConnectionShape;
  eventPublisher: {
    subscribeBrowser: (listener: (event: unknown) => void) => () => void;
  };
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

const jsonRoute = <E,>(
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
          if (tag === 'CannotDeleteActiveSessionError' || tag === 'CannotResumeSessionError') {
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

export function createSessionRoutes(deps: SessionRouteDeps): HttpRouter.Route<RouteError, never>[] {
  const { spawnSession, sessionCleanup, sessionQueries, terminalConnection, eventPublisher } = deps;

  return [
    HttpRouter.route(
      'GET',
      '/',
      Effect.gen(function* () {
        const sessions = sessionQueries.listAll().map(sessionToDTO);
        return yield* renderPage(<DashboardPage sessions={sessions} homedir={homedirFn()} />, {
          title: 'vigie',
        });
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/create',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.text;
        const params = new URLSearchParams(body);
        const cwd = expandPath(params.get('cwd') ?? '~');
        const agentType = params.get('agentType') ?? 'claude';
        yield* spawnSession
          .spawnInteractive({ agentType, cwd, cols: 220, rows: 50 })
          .pipe(Effect.catch(() => Effect.void));
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/kill',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        terminalConnection.kill(sessionId);
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        yield* spawnSession
          .resume(sessionId, { cols: 220, rows: 50 })
          .pipe(Effect.catch(() => Effect.void));
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/delete',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        const session = sessionQueries.findById(sessionId);
        if (session?.canDelete) {
          sessionCleanup.delete(sessionId);
        }
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/clear-ended',
      Effect.sync(() => {
        sessionCleanup.deleteAllEnded();
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/kill-all',
      Effect.sync(() => {
        terminalConnection.killAll();
        return HttpServerResponse.redirect('/');
      })
    ),

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
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const pid = terminalConnection.getActivePid(sessionId);
        if (pid === null) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Session not found or not active' },
            { status: 404 }
          );
        }
        terminalConnection.kill(sessionId);
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
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
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
        terminalConnection.killAll();
        return HttpServerResponse.jsonUnsafe({ killedCount: -1 }); // count not tracked
      })
    ),

    HttpRouter.route(
      'GET',
      '/ws/events',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;

        yield* Effect.logInfo('[server] Events WS client connected');

        const sessions = sessionQueries.listAll().map(sessionToDTO);
        const snapshotMsg = encodeJson({ type: 'snapshot', sessions });
        yield* write(snapshotMsg);

        const services = yield* Effect.services();
        const unsub = eventPublisher.subscribeBrowser((event) => {
          Effect.runForkWith(services)(write(encodeJson(event)));
        });

        yield* socket.runRaw(() => {});
        unsub();

        return HttpServerResponse.empty();
      })
    ),
  ];
}
