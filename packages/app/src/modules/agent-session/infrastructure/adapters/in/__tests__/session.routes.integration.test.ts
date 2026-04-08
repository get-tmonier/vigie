import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type { SessionCleanupShape } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { SpawnSessionShape } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import type { TerminalConnectionShape } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId } from '#modules/agent-session/domain/session-id';
import { createSessionApiRoutes } from '../session.api-routes';

// --- Fake domain objects ---

function makeTestSession(id: string): Session {
  return Session.reconstitute({
    id,
    agentType: 'claude',
    cwd: '/tmp',
    startedAt: Date.now(),
    status: 'ended',
    resumable: false,
    mode: 'interactive',
  });
}

// --- Fake port implementations ---

const fakeSessionQueries = (sessions: Session[]): SessionQueriesShape => ({
  listAll: () => sessions,
  findById: (id: string) => sessions.find((s) => s.id === id) ?? null,
  getAllChunks: () => [],
  getInputHistory: () => [],
});

const fakeSpawnSession: SpawnSessionShape = {
  register: () => {},
  spawnInteractive: (_props) => Effect.succeed({ sessionId: SessionId('new-session-id'), pid: 42 }),
  resume: (_sessionId, _opts) => Effect.succeed({ sessionId: SessionId('resumed-id'), pid: 99 }),
};

const fakeSessionCleanup: SessionCleanupShape = {
  delete: () => {},
  deleteAllEnded: () => {},
};

const fakeTerminalConnection: TerminalConnectionShape = {
  setupPtyLifecycle: () => {},
  kill: () => {},
  killAll: () => {},
  getActivePid: () => null,
  attach: () => null,
  detach: () => {},
  updateCliResize: () => {},
  handleDisconnect: () => {},
  writeInput: () => {},
  applyResizePriority: () => null,
  addBrowserChannel: () => null,
  updateBrowserChannel: () => {},
  removeBrowserChannel: () => {},
  writeBinaryInput: () => {},
};

// --- Helper to build test handler ---

function buildHandler(sessions: Session[] = []) {
  const deps = {
    spawnSession: fakeSpawnSession,
    sessionCleanup: fakeSessionCleanup,
    sessionQueries: fakeSessionQueries(sessions),
    terminalConnection: fakeTerminalConnection,
  };
  const routes = createSessionApiRoutes(deps);
  const appLayer = Layer.mergeAll(HttpRouter.layer, HttpRouter.addAll(routes));
  return HttpRouter.toWebHandler(appLayer, { disableLogger: true });
}

// --- Tests ---

describe('session.routes integration', () => {
  describe('GET /api/sessions', () => {
    it('returns empty session list when no sessions exist', async () => {
      const { handler, dispose } = buildHandler([]);
      try {
        const response = await handler(new Request('http://localhost/api/sessions'));
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ sessions: [] });
      } finally {
        await dispose();
      }
    });

    it('returns session list with mapped DTOs', async () => {
      const session = makeTestSession('test-session-1');
      const { handler, dispose } = buildHandler([session]);
      try {
        const response = await handler(new Request('http://localhost/api/sessions'));
        expect(response.status).toBe(200);
        const body = (await response.json()) as { sessions: { id: string }[] };
        expect(body.sessions).toHaveLength(1);
        expect(body.sessions[0].id).toBe('test-session-1');
      } finally {
        await dispose();
      }
    });
  });

  describe('POST /api/sessions', () => {
    it('spawns a session and returns the session ID', async () => {
      const { handler, dispose } = buildHandler([]);
      try {
        const response = await handler(
          new Request('http://localhost/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentType: 'claude', cwd: '/tmp', cols: 120, rows: 30 }),
          })
        );
        expect(response.status).toBe(200);
        const body = (await response.json()) as { sessionId: string };
        expect(typeof body.sessionId).toBe('string');
      } finally {
        await dispose();
      }
    });

    it('returns 400 for invalid request body', async () => {
      const { handler, dispose } = buildHandler([]);
      try {
        const response = await handler(
          new Request('http://localhost/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cols: 'not-a-number' }),
          })
        );
        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toBe('Invalid request body');
      } finally {
        await dispose();
      }
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('returns 404 for unknown session', async () => {
      const { handler, dispose } = buildHandler([]);
      try {
        const response = await handler(
          new Request('http://localhost/api/sessions/unknown-id', {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = (await response.json()) as { error: string };
        expect(body.error).toBe('Session not found');
      } finally {
        await dispose();
      }
    });

    it('returns 409 when session cannot be deleted (active)', async () => {
      const session = Session.reconstitute({
        id: 'active-session',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'active',
        resumable: false,
        mode: 'interactive',
      });
      const { handler, dispose } = buildHandler([session]);
      try {
        const response = await handler(
          new Request('http://localhost/api/sessions/active-session', {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(409);
      } finally {
        await dispose();
      }
    });
  });
});
