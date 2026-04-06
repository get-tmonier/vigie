import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import type { AgentSession } from '@vigie/shared';
import { SpawnSessionRequestSchema } from '@vigie/shared';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as Layer from 'effect/Layer';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import * as v from 'valibot';
import type { createSessionStore } from '../persistence/session-store.js';
import type { EventBus } from './event-bus.js';
import type { TerminalSubscribers } from './terminal-subscribers.js';

export interface PtyEntry {
  handle: {
    readonly pid: number;
    onOutput: (cb: (data: Uint8Array) => void) => void;
    write: (data: Uint8Array) => void;
    resize: (cols: number, rows: number) => void;
    wait: () => Promise<number>;
    kill: () => void;
  };
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

interface DaemonDeps {
  store: ReturnType<typeof createSessionStore>;
  ptyHandles: Map<string, PtyEntry>;
  eventBus: EventBus;
  terminalSubs: TerminalSubscribers;
  spawnSession: (opts: {
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
  }) => Promise<{ sessionId: string }>;
  resumeSession: (
    sessionId: string,
    opts: { cols: number; rows: number }
  ) => Promise<{ sessionId: string }>;
  applyResizePriority: (sessionId: string) => { cols: number; rows: number } | null;
  inputLineBufferWrite: (sessionId: string, base64Data: string, source: 'cli' | 'browser') => void;
}

function expandPath(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return resolve(homedir(), p.slice(2) || '.');
  }
  return resolve(p);
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export function createRoutesLayer(deps: DaemonDeps & { uiDistPath?: string }) {
  type RouteError =
    | HttpServerError.HttpServerError
    | Socket.SocketError
    | Cause.UnknownError
    | never;
  const routes: Array<HttpRouter.Route<RouteError, never>> = [];

  // Helper to create route with error handling baked in
  const jsonRoute = <E>(
    method: 'GET' | 'POST' | 'DELETE',
    path: HttpRouter.PathInput,
    handler: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      E,
      HttpServerRequest.HttpServerRequest | HttpRouter.RouteContext
    >
  ) =>
    HttpRouter.route(
      method,
      path,
      handler.pipe(
        Effect.catch((err) =>
          Effect.succeed(
            HttpServerResponse.jsonUnsafe(
              { error: err instanceof Error ? err.message : String(err) },
              { status: 500 }
            )
          )
        )
      )
    );

  // Health check
  routes.push(
    HttpRouter.route(
      'GET',
      '/api/health',
      HttpServerResponse.jsonUnsafe({ status: 'ok', pid: process.pid })
    )
  );

  // List all sessions
  routes.push(
    HttpRouter.route(
      'GET',
      '/api/sessions',
      Effect.sync(() => {
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
        return HttpServerResponse.jsonUnsafe({ sessions });
      })
    )
  );

  // Spawn new session
  routes.push(
    jsonRoute(
      'POST',
      '/api/sessions',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const raw = yield* request.json;
        const parsed = v.safeParse(SpawnSessionRequestSchema, raw);
        if (!parsed.success) {
          return HttpServerResponse.jsonUnsafe({ error: 'Invalid request body' }, { status: 400 });
        }
        const body = parsed.output;
        const result = yield* Effect.tryPromise(() =>
          deps.spawnSession({
            agentType: body.agentType ?? 'claude',
            cwd: body.cwd ?? '~',
            cols: body.cols ?? 120,
            rows: body.rows ?? 30,
          })
        );
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    )
  );

  // Kill session
  routes.push(
    HttpRouter.route(
      'POST',
      '/api/sessions/:id/kill',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const entry = deps.ptyHandles.get(sessionId);
        if (!entry) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Session not found or not active' },
            { status: 404 }
          );
        }
        entry.handle.kill();
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    )
  );

  // Resume session
  routes.push(
    jsonRoute(
      'POST',
      '/api/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const session = deps.store.getSessionById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (session.status !== 'ended') {
          return HttpServerResponse.jsonUnsafe({ error: 'Session is not ended' }, { status: 400 });
        }
        if (!session.resumable) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'This session cannot be resumed' },
            { status: 400 }
          );
        }
        if (!session.claude_session_id) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'No Claude session ID detected' },
            { status: 400 }
          );
        }

        let cols = 120;
        let rows = 30;
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* Effect.gen(function* () {
          const body = (yield* request.json) as { cols?: number; rows?: number };
          if (typeof body.cols === 'number') cols = body.cols;
          if (typeof body.rows === 'number') rows = body.rows;
        }).pipe(Effect.catch(() => Effect.void));

        const result = yield* Effect.tryPromise(() =>
          deps.resumeSession(sessionId, { cols, rows })
        );
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    )
  );

  // Delete session
  routes.push(
    HttpRouter.route(
      'DELETE',
      '/api/sessions/:id',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const session = deps.store.getSessionById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (session.status === 'active') {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Cannot delete an active session' },
            { status: 400 }
          );
        }
        deps.store.deleteSessionById(sessionId);
        deps.eventBus.publish({ type: 'session:deleted', sessionId, timestamp: Date.now() });
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    )
  );

  // Clear ended sessions
  routes.push(
    HttpRouter.route(
      'POST',
      '/api/sessions/clear-ended',
      Effect.sync(() => {
        deps.store.deleteEndedSessions();
        deps.eventBus.publish({ type: 'sessions:cleared', timestamp: Date.now() });
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    )
  );

  // Kill all sessions
  routes.push(
    HttpRouter.route(
      'POST',
      '/api/sessions/kill-all',
      Effect.sync(() => {
        let killedCount = 0;
        for (const [sessionId, entry] of deps.ptyHandles) {
          entry.handle.kill();
          killedCount++;
          console.log(`[server] Kill requested for session ${sessionId}`);
        }
        return HttpServerResponse.jsonUnsafe({ killedCount });
      })
    )
  );

  // Execute shell command
  routes.push(
    jsonRoute(
      'POST',
      '/api/exec',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = (yield* request.json) as { command: string; cwd?: string };
        const commandId = crypto.randomUUID();
        const resolvedCwd = body.cwd ? expandPath(body.cwd) : undefined;

        const readStream = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
          if (!stream) return '';
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              result += decoder.decode(value, { stream: true });
            }
          } finally {
            reader.releaseLock();
          }
          return result;
        };

        const proc = Bun.spawn(['sh', '-c', body.command], {
          cwd: resolvedCwd,
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const [stdout, stderr] = yield* Effect.tryPromise(() =>
          Promise.all([readStream(proc.stdout), readStream(proc.stderr)])
        );
        const exitCode = yield* Effect.tryPromise(() => proc.exited);
        return HttpServerResponse.jsonUnsafe({ commandId, stdout, stderr, exitCode });
      })
    )
  );

  // List directory
  routes.push(
    HttpRouter.route(
      'POST',
      '/api/fs/list',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = (yield* request.json) as { path?: string };
        const dirPath = expandPath(body.path ?? '~');
        try {
          const items = readdirSync(dirPath, { withFileTypes: true });
          const entries = items
            .filter((item) => !item.name.startsWith('.'))
            .map((item) => ({ name: item.name, isDirectory: item.isDirectory() }))
            .sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          return HttpServerResponse.jsonUnsafe({ entries });
        } catch (err) {
          return HttpServerResponse.jsonUnsafe(
            { entries: [], error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          );
        }
      })
    )
  );

  // Get terminal chunks for a session (for replay)
  routes.push(
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
    )
  );

  // Get input history for a session
  routes.push(
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
    )
  );

  // ── WebSocket routes ──

  // Events WebSocket — broadcasts daemon events to browser clients
  routes.push(
    HttpRouter.route(
      'GET',
      '/ws/events',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;

        console.log('[server] Events WS client connected');

        // Send initial snapshot of all sessions
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

        // Subscribe to event bus — forward all events as JSON
        const unsub = deps.eventBus.subscribe((event) => {
          Effect.runFork(write(JSON.stringify(event)));
        });

        // Keep connection alive until socket closes
        yield* socket.runRaw(() => {});

        // Cleanup
        unsub();

        return HttpServerResponse.empty();
      })
    )
  );

  // Terminal WebSocket — bidirectional terminal I/O for a session
  routes.push(
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

        // Replay existing terminal chunks
        const chunks = deps.store.getAllTerminalChunks(sessionId);
        for (const chunk of chunks) {
          const payload = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
          yield* write(payload);
        }

        // Subscribe to live terminal output
        const unsub = deps.terminalSubs.subscribe(sessionId, (data: string) => {
          const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          Effect.runFork(write(payload));
        });

        // Register browser channel for resize priority
        const entry = deps.ptyHandles.get(sessionId);
        if (entry) {
          entry.browserChannels.set(browserConnId, { cols: 120, rows: 30 });
        }

        // Handle incoming messages (keyboard input + control messages)
        yield* socket.runRaw((message) => {
          if (typeof message === 'string') {
            try {
              const parsed = JSON.parse(message) as { type?: string; cols?: number; rows?: number };
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

        // Cleanup on socket close
        unsub();
        if (entry) {
          entry.browserChannels.delete(browserConnId);
          deps.applyResizePriority(sessionId);
        }

        return HttpServerResponse.empty();
      })
    )
  );

  // Static file serving for embedded UI
  if (deps.uiDistPath && existsSync(deps.uiDistPath)) {
    const uiPath = deps.uiDistPath;

    routes.push(
      HttpRouter.route('GET', '*', (request) =>
        Effect.sync(() => {
          const urlPath = new URL(request.url, 'http://localhost').pathname;

          // Skip API and WS paths
          if (urlPath.startsWith('/api/') || urlPath.startsWith('/ws/')) {
            return HttpServerResponse.empty({ status: 404 });
          }

          // Try to serve the exact file
          const filePath = join(uiPath, urlPath === '/' ? 'index.html' : urlPath);
          if (existsSync(filePath)) {
            const ext = extname(filePath);
            const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
            const content = readFileSync(filePath);
            return HttpServerResponse.uint8Array(new Uint8Array(content), { contentType });
          }

          // SPA fallback — serve index.html for client-side routing
          const indexPath = join(uiPath, 'index.html');
          if (existsSync(indexPath)) {
            const content = readFileSync(indexPath);
            return HttpServerResponse.uint8Array(new Uint8Array(content), {
              contentType: 'text/html',
            });
          }

          return HttpServerResponse.empty({ status: 404 });
        })
      )
    );
  }

  return Layer.mergeAll(HttpRouter.layer, HttpRouter.addAll(routes));
}
