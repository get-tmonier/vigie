import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { AppEventPublisher } from '#modules/daemon/adapters/event-publisher.adapter';
import { sessionToDTO } from '#modules/session/adapters/primary/session.mapper';
import type { SessionService } from '#modules/session/session.service';
import type { TerminalSubscribers } from '#modules/terminal/terminal-subscribers';

type TerminalRouteDeps = {
  sessionService: SessionService;
  eventPublisher: AppEventPublisher;
  terminalSubs: TerminalSubscribers;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError | never;

export function createTerminalRoutes(
  deps: TerminalRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  const { sessionService, eventPublisher, terminalSubs } = deps;

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
      '/ws/events',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;

        console.log('[server] Events WS client connected');

        const sessions = sessionService.listAll().map(sessionToDTO);
        yield* write(JSON.stringify({ type: 'snapshot', sessions }));

        const unsub = eventPublisher.subscribeBrowser((event) => {
          Effect.runFork(write(JSON.stringify(event)));
        });

        yield* socket.runRaw(() => {});
        unsub();

        return HttpServerResponse.empty();
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

        console.log(`[server] Terminal WS client connected for session ${sessionId}`);

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
