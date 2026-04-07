import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionService } from '#modules/session/application/session.service';
import type { TerminalSubscribersShape } from '#modules/terminal/application/terminal-subscribers';

type TerminalRouteDeps = {
  sessionService: SessionService;
  terminalSubs: TerminalSubscribersShape;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError | never;

export function createTerminalRoutes(
  deps: TerminalRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  const { sessionService, terminalSubs } = deps;

  return [
    HttpRouter.route(
      'GET',
      '/api/sessions/:id/chunks',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const chunks = sessionService.getAllChunks(sessionId);
        return HttpServerResponse.jsonUnsafe({ chunks });
      })
    ),

    HttpRouter.route(
      'GET',
      '/api/sessions/:id/input-history',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const request = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL(request.url, 'http://localhost');
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 200;
        const history = sessionService.getInputHistory(sessionId, limit);
        return HttpServerResponse.jsonUnsafe({ history });
      })
    ),

    HttpRouter.route(
      'GET',
      '/ws/terminal/:sessionId',
      Effect.gen(function* () {
        const { sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }

        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;
        const browserConnId = crypto.randomUUID();

        yield* Effect.logInfo(`[server] Terminal WS client connected for session ${sessionId}`);

        const chunks = sessionService.getAllChunks(sessionId);
        for (const chunk of chunks) {
          const payload = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
          yield* write(payload);
        }

        const entry = sessionService.ptyHandles.get(sessionId);

        const unsub = terminalSubs.subscribe(sessionId, (data: string) => {
          const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          Effect.runFork(write(payload));
        });

        if (entry) {
          entry.browserChannels.set(browserConnId, { cols: 120, rows: 30 });
        }

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
                const ptyEntry = sessionService.ptyHandles.get(sessionId);
                if (ptyEntry) {
                  ptyEntry.browserChannels.set(browserConnId, {
                    cols: parsed.cols,
                    rows: parsed.rows,
                  });
                  sessionService.applyResizePriority(sessionId);
                }
              }
            } catch {}
          } else if (message.length > 0) {
            const ptyEntry = sessionService.ptyHandles.get(sessionId);
            if (ptyEntry) {
              ptyEntry.handle.write(message);
              const base64 = Buffer.from(message).toString('base64');
              sessionService.writeInput(sessionId, base64, 'browser');
            }
          }
        });

        unsub();
        if (entry) {
          entry.browserChannels.delete(browserConnId);
          sessionService.applyResizePriority(sessionId);
        }

        return HttpServerResponse.empty();
      })
    ),
  ];
}
