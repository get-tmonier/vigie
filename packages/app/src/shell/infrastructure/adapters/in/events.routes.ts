import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as Schema from 'effect/Schema';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { sessionToDTO } from '#modules/agent-session/infrastructure/adapters/in/session.mapper';
import type { BrowserEventBusShape } from '#shell/application/ports/out/browser-event-bus.port';

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

type EventRouteDeps = {
  sessionQueries: SessionQueriesShape;
  browserEventBus: BrowserEventBusShape;
};

export function createEventsRoutes(deps: EventRouteDeps): HttpRouter.Route<RouteError, never>[] {
  const { sessionQueries, browserEventBus } = deps;

  return [
    HttpRouter.route(
      'GET',
      '/ws/events',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;

        yield* Effect.logInfo('[server] Events WS client connected');

        const sessions = sessionQueries.listAll().map(sessionToDTO);
        yield* write(encodeJson({ type: 'snapshot', sessions }));

        const services = yield* Effect.services();
        const unsub = browserEventBus.subscribe((event) => {
          Effect.runForkWith(services)(write(encodeJson(event)));
        });

        yield* socket.runRaw(() => {});
        unsub();

        return HttpServerResponse.empty();
      })
    ),
  ];
}
