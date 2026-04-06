import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
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

export function createServerApp(deps: DaemonDeps & { uiDistPath?: string }) {
  const app = new Hono();

  app.use('*', cors());

  // Health check
  app.get('/api/health', (c) => c.json({ status: 'ok', pid: process.pid }));

  // List all sessions
  app.get('/api/sessions', (c) => {
    const rows = deps.store.getAllSessions();
    const sessions = rows.map((row) => ({
      id: row.id,
      agentType: row.agent_type,
      mode: row.mode,
      cwd: row.cwd,
      gitBranch: row.git_branch ?? undefined,
      repoName: row.repo_name ?? undefined,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      status: row.status,
      exitCode: row.exit_code ?? undefined,
      claudeSessionId: row.claude_session_id ?? undefined,
      resumable: row.resumable === 1,
    }));
    return c.json({ sessions });
  });

  // Spawn new session
  app.post('/api/sessions', async (c) => {
    const body = await c.req.json<{
      agentType?: string;
      cwd?: string;
      cols?: number;
      rows?: number;
    }>();

    try {
      const result = await deps.spawnSession({
        agentType: body.agentType ?? 'claude',
        cwd: body.cwd ?? '~',
        cols: body.cols ?? 120,
        rows: body.rows ?? 30,
      });
      return c.json({ sessionId: result.sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // Kill session
  app.post('/api/sessions/:id/kill', (c) => {
    const sessionId = c.req.param('id');
    const entry = deps.ptyHandles.get(sessionId);
    if (!entry) {
      return c.json({ error: 'Session not found or not active' }, 404);
    }
    entry.handle.kill();
    return c.json({ ok: true });
  });

  // Resume session
  app.post('/api/sessions/:id/resume', async (c) => {
    const sessionId = c.req.param('id');
    const session = deps.store.getSessionById(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    if (session.status !== 'ended') {
      return c.json({ error: 'Session is not ended' }, 400);
    }
    if (!session.resumable) {
      return c.json({ error: 'This session cannot be resumed' }, 400);
    }
    if (!session.claude_session_id) {
      return c.json({ error: 'No Claude session ID detected for this session' }, 400);
    }

    const body = await c.req
      .json<{ cols?: number; rows?: number }>()
      .catch(() => ({ cols: undefined, rows: undefined }));

    try {
      const result = await deps.resumeSession(sessionId, {
        cols: body.cols ?? 120,
        rows: body.rows ?? 30,
      });
      return c.json({ sessionId: result.sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  // Delete session
  app.delete('/api/sessions/:id', (c) => {
    const sessionId = c.req.param('id');
    const session = deps.store.getSessionById(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    if (session.status === 'active') {
      return c.json({ error: 'Cannot delete an active session' }, 400);
    }
    deps.store.deleteSessionById(sessionId);
    deps.eventBus.publish({
      type: 'session:deleted',
      sessionId,
      timestamp: Date.now(),
    });
    return c.json({ ok: true });
  });

  // Clear ended sessions
  app.post('/api/sessions/clear-ended', (c) => {
    deps.store.deleteEndedSessions();
    deps.eventBus.publish({
      type: 'sessions:cleared',
      timestamp: Date.now(),
    });
    return c.json({ ok: true });
  });

  // Kill all sessions
  app.post('/api/sessions/kill-all', (c) => {
    let killedCount = 0;
    for (const [sessionId, entry] of deps.ptyHandles) {
      entry.handle.kill();
      killedCount++;
      console.log(`[server] Kill requested for session ${sessionId}`);
    }
    return c.json({ killedCount });
  });

  // Execute shell command
  app.post('/api/exec', async (c) => {
    const body = await c.req.json<{ command: string; cwd?: string }>();
    const commandId = crypto.randomUUID();
    const resolvedCwd = body.cwd ? expandPath(body.cwd) : undefined;

    // Run command and collect output
    try {
      const proc = Bun.spawn(['sh', '-c', body.command], {
        cwd: resolvedCwd,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      let stdout = '';
      let stderr = '';

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

      [stdout, stderr] = await Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);

      const exitCode = await proc.exited;

      return c.json({ commandId, stdout, stderr, exitCode });
    } catch (err) {
      return c.json({ commandId, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // List directory
  app.post('/api/fs/list', async (c) => {
    const body = await c.req.json<{ path?: string }>();
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
      return c.json({ entries });
    } catch (err) {
      return c.json({ entries: [], error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Get terminal chunks for a session (for replay)
  app.get('/api/sessions/:id/chunks', (c) => {
    const sessionId = c.req.param('id');
    const chunks = deps.store.getAllTerminalChunks(sessionId);
    return c.json({ chunks });
  });

  // Get input history for a session
  app.get('/api/sessions/:id/input-history', (c) => {
    const sessionId = c.req.param('id');
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 200;
    const history = deps.store.getInputHistory(sessionId, limit);
    return c.json({ history });
  });

  // Static file serving for embedded UI
  if (deps.uiDistPath && existsSync(deps.uiDistPath)) {
    const uiPath = deps.uiDistPath;

    app.get('*', (c) => {
      const urlPath = new URL(c.req.url).pathname;

      // Try to serve the exact file
      const filePath = join(uiPath, urlPath === '/' ? 'index.html' : urlPath);
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
        const content = readFileSync(filePath);
        return new Response(content, {
          headers: { 'Content-Type': contentType },
        });
      }

      // SPA fallback — serve index.html for client-side routing
      const indexPath = join(uiPath, 'index.html');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        return new Response(content, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return c.notFound();
    });
  }

  return app;
}
