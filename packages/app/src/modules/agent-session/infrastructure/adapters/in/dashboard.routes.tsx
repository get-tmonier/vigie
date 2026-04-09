import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { renderPage } from '#shared/ssr/render-page';
import type { AgentSession } from './session.dto';
import { sessionToDTO } from './session.mapper';

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

function DashboardPage({ sessions, homedir }: { sessions: AgentSession[]; homedir: string }) {
  return (
    <div className="h-screen bg-navy-900 text-cream-50 font-body">
      <div
        id="vigie-initial-data"
        data-sessions={JSON.stringify(sessions)}
        data-homedir={homedir}
        className="hidden"
      />
      <div id="dashboard-app" className="h-full" />
    </div>
  );
}

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
