import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { StructuredEventStoreShape } from '#modules/agent-session/application/ports/out/structured-event-store.port';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { mapHookEvent } from '#modules/agent-session/infrastructure/adapters/out/agents/hook-event-mapper';

type HookRouteDeps = {
  sessionQueries: SessionQueriesShape;
  eventPublisher: SessionEventBusShape;
  structuredEventStore: StructuredEventStoreShape;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

export function createHookRoutes(deps: HookRouteDeps): HttpRouter.Route<RouteError, never>[] {
  const { sessionQueries, eventPublisher, structuredEventStore } = deps;

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) => Effect.logWarning('Hook event publish failed', cause))
    );
  }

  return [
    HttpRouter.route(
      'POST',
      '/api/hooks',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const raw = yield* request.json;
        const payload = raw as {
          type: string;
          session_id?: string;
          cwd?: string;
          [key: string]: unknown;
        };

        const allSessions = sessionQueries.listAll();
        const match = allSessions.find(
          (s) =>
            (payload.session_id && s.agentSessionId === payload.session_id) ||
            (payload.cwd && s.cwd === payload.cwd && s.isActive)
        );

        if (!match) {
          return HttpServerResponse.jsonUnsafe({ ok: true, matched: false });
        }

        const events = mapHookEvent(match.id, match.currentTurnIndex, payload);

        for (const event of events) {
          switch (event.type) {
            case 'agent:tool-call':
              if (event.status === 'running') structuredEventStore.insertToolCall(event);
              else structuredEventStore.updateToolCall(event);
              break;
            case 'agent:text-delta':
              structuredEventStore.insertTextDelta(event);
              break;
            case 'agent:cost-update':
              structuredEventStore.insertCostUpdate(event);
              break;
            case 'agent:subagent-spawn':
              structuredEventStore.insertSubagentSpawn(event);
              break;
          }

          fireAndForget(eventPublisher.publish(event));
        }

        return HttpServerResponse.jsonUnsafe({
          ok: true,
          matched: true,
          eventsProcessed: events.length,
        });
      })
    ),
  ];
}
