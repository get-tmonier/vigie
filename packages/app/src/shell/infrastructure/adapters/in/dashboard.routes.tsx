import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionCleanupShape } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { SpawnSessionShape } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import type { TerminalConnectionShape } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { DashboardPage } from '#modules/agent-session/infrastructure/adapters/in/dashboard.view';
import { sessionToDTO } from '#modules/agent-session/infrastructure/adapters/in/session.mapper';
import { expandPath } from '#shared/lib/path';
import { renderPage } from '#shared/ssr/render-page';

type DashboardRouteDeps = {
  spawnSession: SpawnSessionShape;
  sessionCleanup: SessionCleanupShape;
  sessionQueries: SessionQueriesShape;
  terminalConnection: TerminalConnectionShape;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

export function createDashboardRoutes(
  deps: DashboardRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  const { spawnSession, sessionCleanup, sessionQueries, terminalConnection } = deps;

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
  ];
}
