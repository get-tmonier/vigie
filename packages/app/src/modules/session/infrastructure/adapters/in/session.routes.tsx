import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import * as v from 'valibot';
import { renderPage } from '#infra/ssr/render-page';
import type { SessionService } from '#modules/session/application/session.service';
import { SessionId } from '#modules/session/domain/session-id';
import { expandPath } from '#modules/session/infrastructure/adapters/expand-path';
import { SpawnSessionRequestSchema } from '#modules/session/infrastructure/adapters/in/session.dto';
import { sessionToDTO } from './session.mapper';
import { DashboardPage } from './session.page';

type SessionRouteDeps = {
  sessionService: SessionService;
};

type RouteError = HttpServerError.HttpServerError | Cause.UnknownError | never;

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
  const { sessionService } = deps;

  return [
    // SSR dashboard
    HttpRouter.route(
      'GET',
      '/',
      Effect.gen(function* () {
        const sessions = sessionService.listAll().map(sessionToDTO);
        return yield* renderPage(<DashboardPage sessions={sessions} homedir={homedirFn()} />, {
          title: 'vigie',
        });
      })
    ),

    // Form actions — mutations POST → redirect to /
    HttpRouter.route(
      'POST',
      '/sessions/create',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.text;
        const params = new URLSearchParams(body);
        const cwd = expandPath(params.get('cwd') ?? '~');
        const agentType = params.get('agentType') ?? 'claude';
        yield* sessionService
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
        sessionService.kill(SessionId(sessionId));
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        yield* sessionService
          .resume(SessionId(sessionId), { cols: 220, rows: 50 })
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
        const session = sessionService.findById(SessionId(sessionId));
        if (session?.canDelete) {
          sessionService.delete(SessionId(sessionId));
        }
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/clear-ended',
      Effect.sync(() => {
        sessionService.deleteAllEnded();
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/kill-all',
      Effect.sync(() => {
        for (const entry of sessionService.ptyHandles.values()) {
          entry.handle.kill();
        }
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
        const sessions = sessionService.listAll().map(sessionToDTO);
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
        const result = yield* sessionService.spawnInteractive({
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
        const entry = sessionService.ptyHandles.get(sessionId);
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
        const session = sessionService.findById(SessionId(sessionId));
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (!session.canResume) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'This session cannot be resumed' },
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

        const result = yield* sessionService.resume(SessionId(sessionId), { cols, rows });
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
        const session = sessionService.findById(SessionId(sessionId));
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (!session.canDelete) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Cannot delete an active session' },
            { status: 400 }
          );
        }
        sessionService.delete(SessionId(sessionId));
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/clear-ended',
      Effect.sync(() => {
        sessionService.deleteAllEnded();
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/kill-all',
      Effect.gen(function* () {
        let killedCount = 0;
        for (const [sessionId, entry] of sessionService.ptyHandles) {
          entry.handle.kill();
          killedCount++;
          yield* Effect.logInfo(`[server] Kill requested for session ${sessionId}`);
        }
        return HttpServerResponse.jsonUnsafe({ killedCount });
      })
    ),
  ];
}
