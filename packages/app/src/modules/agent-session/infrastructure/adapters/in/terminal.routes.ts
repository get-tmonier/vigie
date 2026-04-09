import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { TerminalConnectionShape } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { TerminalSubscribersShape } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';

type TerminalRouteDeps = {
  sessionQueries: SessionQueriesShape;
  terminalConnection: TerminalConnectionShape;
  terminalSubs: TerminalSubscribersShape;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

export function createTerminalRoutes(
  deps: TerminalRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  const { sessionQueries, terminalConnection, terminalSubs } = deps;

  return [
    HttpRouter.route(
      'GET',
      '/api/sessions/:id/chunks',
      Effect.gen(function* () {
        const { id: rawSessionId } = yield* HttpRouter.params;
        if (!rawSessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const sessionId = makeSessionId(rawSessionId);
        const chunks = sessionQueries.getAllChunks(sessionId);
        return HttpServerResponse.jsonUnsafe({ chunks });
      })
    ),

    HttpRouter.route(
      'GET',
      '/api/sessions/:id/input-history',
      Effect.gen(function* () {
        const { id: rawSessionId } = yield* HttpRouter.params;
        if (!rawSessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const sessionId = makeSessionId(rawSessionId);
        const request = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL(request.url, 'http://localhost');
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 200;
        const history = sessionQueries.getInputHistory(sessionId, limit);
        return HttpServerResponse.jsonUnsafe({ history });
      })
    ),

    HttpRouter.route(
      'GET',
      '/ws/terminal/:sessionId',
      Effect.gen(function* () {
        const { sessionId: rawSessionId } = yield* HttpRouter.params;
        if (!rawSessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const sessionId = makeSessionId(rawSessionId);

        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;
        const browserConnId = crypto.randomUUID();

        yield* Effect.logInfo(`[server] Terminal WS client connected for session ${sessionId}`);

        const chunks = sessionQueries.getAllChunks(sessionId);
        for (const chunk of chunks) {
          const payload = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
          yield* write(payload);
        }

        terminalConnection.addBrowserChannel(sessionId, browserConnId, { cols: 120, rows: 30 });

        const services = yield* Effect.services();
        const unsub = terminalSubs.subscribe(sessionId, (data: string) => {
          const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          Effect.runForkWith(services)(write(payload));
        });

        yield* socket.runRaw((message) => {
          if (typeof message === 'string') {
            try {
              const parsed = JSON.parse(message) as {
                type?: string;
                cols?: number;
                rows?: number;
              };
              if (
                parsed.type === 'resize' &&
                typeof parsed.cols === 'number' &&
                typeof parsed.rows === 'number'
              ) {
                terminalConnection.updateBrowserChannel(sessionId, browserConnId, {
                  cols: parsed.cols,
                  rows: parsed.rows,
                });
              }
            } catch {}
          } else if (message.length > 0) {
            terminalConnection.writeBinaryInput(sessionId, message);
          }
        });

        unsub();
        terminalConnection.removeBrowserChannel(sessionId, browserConnId);

        return HttpServerResponse.empty();
      })
    ),
  ];
}
