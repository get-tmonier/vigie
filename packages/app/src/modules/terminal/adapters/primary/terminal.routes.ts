import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { createSessionStore } from '#modules/daemon/persistence/session-store';
import type { AgentSession } from '#modules/session/schemas';
import type { EventBus } from '#modules/terminal/event-bus';
import type { PtyEntry } from '#modules/terminal/terminal.service';
import type { TerminalSubscribers } from '#modules/terminal/terminal-subscribers';

type TerminalRouteDeps = {
  store: ReturnType<typeof createSessionStore>;
  ptyHandles: Map<string, PtyEntry>;
  terminalSubs: TerminalSubscribers;
  eventBus: EventBus;
  applyResizePriority: (sessionId: string) => { cols: number; rows: number } | null;
  inputLineBufferWrite: (sessionId: string, base64Data: string, source: 'cli' | 'browser') => void;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError | never;

export function createTerminalRoutes(
  deps: TerminalRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  return [
    HttpRouter.route(
      'GET',
      '/api/sessions/:id/chunks',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const chunks = deps.store.getAllTerminalChunks(sessionId);
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
        const history = deps.store.getInputHistory(sessionId, limit);
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

        const rows = deps.store.getAllSessions();
        const sessions: AgentSession[] = rows.map((row) => ({
          id: row.id,
          agentType: row.agent_type,
          mode: row.mode,
          cwd: row.cwd,
          gitBranch: row.git_branch ?? undefined,
          repoName: row.repo_name ?? undefined,
          startedAt: row.started_at,
          endedAt: row.ended_at ?? undefined,
          status: row.status as AgentSession['status'],
          exitCode: row.exit_code ?? undefined,
          claudeSessionId: row.claude_session_id ?? undefined,
          resumable: row.resumable === 1,
        }));
        yield* write(JSON.stringify({ type: 'snapshot', sessions }));

        const unsub = deps.eventBus.subscribe((event) => {
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

        const chunks = deps.store.getAllTerminalChunks(sessionId);
        for (const chunk of chunks) {
          const payload = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
          yield* write(payload);
        }

        const unsub = deps.terminalSubs.subscribe(sessionId, (data: string) => {
          const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          Effect.runFork(write(payload));
        });

        const entry = deps.ptyHandles.get(sessionId);
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
                const ptyEntry = deps.ptyHandles.get(sessionId);
                if (ptyEntry) {
                  ptyEntry.browserChannels.set(browserConnId, {
                    cols: parsed.cols,
                    rows: parsed.rows,
                  });
                  deps.applyResizePriority(sessionId);
                }
              }
            } catch {}
          } else if (message.length > 0) {
            const ptyEntry = deps.ptyHandles.get(sessionId);
            if (ptyEntry) {
              ptyEntry.handle.write(message);
              const base64 = Buffer.from(message).toString('base64');
              deps.inputLineBufferWrite(sessionId, base64, 'browser');
            }
          }
        });

        unsub();
        if (entry) {
          entry.browserChannels.delete(browserConnId);
          deps.applyResizePriority(sessionId);
        }

        return HttpServerResponse.empty();
      })
    ),
  ];
}
