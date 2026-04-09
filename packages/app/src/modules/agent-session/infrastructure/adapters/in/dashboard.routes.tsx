import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { renderPage } from '#shared/ssr/render-page';
import { DashboardPage } from './dashboard.view';
import { sessionToDTO } from './session.mapper';

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

export function createDashboardRoutes(deps: {
  sessionQueries: SessionQueriesShape;
}): HttpRouter.Route<RouteError, never>[] {
  const { sessionQueries } = deps;
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
  ];
}
