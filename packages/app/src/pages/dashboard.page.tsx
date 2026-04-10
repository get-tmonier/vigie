import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { sessionToDTO } from '#modules/agent-session/infrastructure/adapters/in/session.mapper';
import { renderPage } from '#shared/ssr/render-page';

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

function DashboardPage({ sessions, homedir }: { sessions: AgentSession[]; homedir: string }) {
  return (
    <div className="flex flex-col h-screen bg-navy-900 text-cream-50 font-body">
      <div
        id="vigie-initial-data"
        data-sessions={JSON.stringify(sessions)}
        data-homedir={homedir}
        className="hidden"
      />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg text-vigie-400">vigie</span>
          <span className="text-xs text-cream-200/40">agent supervisor</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <div id="kanban-board-app" className="h-full" />
        <div id="session-detail-v2-app" className="h-full" />
      </main>

      {/* Spawn form */}
      <div id="spawn-form-app" />
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
