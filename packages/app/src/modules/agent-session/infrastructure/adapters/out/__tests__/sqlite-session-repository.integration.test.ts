import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Kysely } from 'kysely';
import { SessionStore } from '#modules/agent-session/application/ports/out/session-store.port';
import { Session } from '#modules/agent-session/domain/session';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { VigiDatabase, type VigiDatabaseServices } from '#shared/db/database';
import { createBunSqliteDialect } from '#shared/db/dialect';
import type { VigiDatabaseSchema } from '#shared/db/schema';
import { SessionId } from '#shared/kernel/session/session-id';

function makeTestDb(): VigiDatabaseServices {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_type TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'prompt',
      cwd TEXT NOT NULL,
      git_branch TEXT,
      git_remote_url TEXT,
      repo_name TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      exit_code INTEGER,
      agent_session_id TEXT,
      resumable INTEGER NOT NULL DEFAULT 0,
      session_type TEXT NOT NULL DEFAULT 'interactive',
      auto_advance INTEGER NOT NULL DEFAULT 0,
      current_turn_index INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS terminal_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      seq INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS input_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      text TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'cli',
      timestamp INTEGER NOT NULL
    );
  `);
  const kysely = new Kysely<VigiDatabaseSchema>({ dialect: createBunSqliteDialect(sqlite) });
  return { sqlite, kysely };
}

const TestDatabaseLayer = Layer.sync(VigiDatabase)(() => makeTestDb());
const TestRepoLayer = SqliteSessionRepositoryLive.pipe(Layer.provide(TestDatabaseLayer));

async function runWithRepo<A>(effect: Effect.Effect<A, never, SessionStore>): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, TestRepoLayer));
}

describe('SqliteSessionRepository', () => {
  describe('save + findById', () => {
    it('saves a session and retrieves it by id', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const session = Session.create({
            agentType: 'claude',
            cwd: '/tmp/test',
            mode: 'interactive',
          });

          repo.save(session);

          const found = repo.findById(session.id);
          expect(found).not.toBeNull();
          expect(found?.id).toBe(session.id);
          expect(found?.agentType).toBe('claude');
          expect(found?.cwd).toBe('/tmp/test');
          expect(found?.status).toBe('active');
          expect(found?.mode).toBe('interactive');
        })
      );
    });

    it('returns null for unknown id', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const found = repo.findById(SessionId('nonexistent'));
          expect(found).toBeNull();
        })
      );
    });

    it('updates an existing session on re-save', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const session = Session.create({ agentType: 'claude', cwd: '/tmp/test' });
          repo.save(session);

          session.setAgentSessionId('agent-abc');
          repo.save(session);

          const found = repo.findById(session.id);
          expect(found?.agentSessionId).toBe('agent-abc');
        })
      );
    });
  });

  describe('findAll', () => {
    it('returns all sessions with active, ended, or error status', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const active = Session.create({ agentType: 'claude', cwd: '/tmp/a' });
          const ended = Session.reconstitute({
            id: 'ended-1',
            agentType: 'claude',
            cwd: '/tmp/b',
            startedAt: Date.now() - 1000,
            endedAt: Date.now() - 500,
            status: 'ended',
            resumable: false,
            mode: 'prompt',
          });
          repo.save(active);
          repo.save(ended);

          const all = repo.findAll();
          const ids = all.map((s) => s.id);
          expect(ids).toContain(active.id);
          expect(ids).toContain(SessionId('ended-1'));
        })
      );
    });
  });

  describe('findActive', () => {
    it('returns only active sessions', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const active = Session.create({ agentType: 'claude', cwd: '/tmp/active' });
          const ended = Session.reconstitute({
            id: 'ended-find-active',
            agentType: 'claude',
            cwd: '/tmp/ended',
            startedAt: Date.now() - 1000,
            endedAt: Date.now() - 500,
            status: 'ended',
            resumable: false,
            mode: 'prompt',
          });
          repo.save(active);
          repo.save(ended);

          const actives = repo.findActive();
          expect(actives.every((s) => s.status === 'active')).toBe(true);
          expect(actives.some((s) => s.id === active.id)).toBe(true);
          expect(actives.some((s) => s.id === SessionId('ended-find-active'))).toBe(false);
        })
      );
    });
  });

  describe('findActiveWithAgentId', () => {
    it('returns active sessions that have an agentSessionId', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const withAgent = Session.create({ agentType: 'claude', cwd: '/tmp/with-agent' });
          withAgent.setAgentSessionId('claude-sess-xyz');
          repo.save(withAgent);

          const withoutAgent = Session.create({ agentType: 'claude', cwd: '/tmp/no-agent' });
          repo.save(withoutAgent);

          const results = repo.findActiveWithAgentId();
          expect(results.some((r) => r.id === withAgent.id)).toBe(true);
          expect(results.some((r) => r.id === withoutAgent.id)).toBe(false);
          const found = results.find((r) => r.id === withAgent.id);
          expect(found?.agentSessionId).toBe('claude-sess-xyz');
        })
      );
    });
  });

  describe('findRecentlyEnded', () => {
    it('returns recently ended sessions with agentSessionId and resumable=false', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const recentEnded = Session.reconstitute({
            id: 'recent-ended-1',
            agentType: 'claude',
            cwd: '/tmp/recent',
            startedAt: Date.now() - 2000,
            endedAt: Date.now() - 100,
            status: 'ended',
            resumable: false,
            agentSessionId: 'agent-recent',
            mode: 'prompt',
          });
          repo.save(recentEnded);

          const oldEnded = Session.reconstitute({
            id: 'old-ended-1',
            agentType: 'claude',
            cwd: '/tmp/old',
            startedAt: Date.now() - 100_000,
            endedAt: Date.now() - 50_000,
            status: 'ended',
            resumable: false,
            agentSessionId: 'agent-old',
            mode: 'prompt',
          });
          repo.save(oldEnded);

          const results = repo.findRecentlyEnded(10_000);
          expect(results.some((r) => r.id === SessionId('recent-ended-1'))).toBe(true);
          expect(results.some((r) => r.id === SessionId('old-ended-1'))).toBe(false);
        })
      );
    });

    it('excludes resumable sessions', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const resumableEnded = Session.reconstitute({
            id: 'resumable-ended-1',
            agentType: 'claude',
            cwd: '/tmp/resumable',
            startedAt: Date.now() - 2000,
            endedAt: Date.now() - 100,
            status: 'ended',
            resumable: true,
            agentSessionId: 'agent-resumable',
            mode: 'prompt',
          });
          repo.save(resumableEnded);

          const results = repo.findRecentlyEnded(10_000);
          expect(results.some((r) => r.id === SessionId('resumable-ended-1'))).toBe(false);
        })
      );
    });
  });

  describe('delete', () => {
    it('removes session and its associated data', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const ended = Session.reconstitute({
            id: 'to-delete-1',
            agentType: 'claude',
            cwd: '/tmp/del',
            startedAt: Date.now() - 1000,
            endedAt: Date.now() - 500,
            status: 'ended',
            resumable: false,
            mode: 'prompt',
          });
          repo.save(ended);

          repo.delete(SessionId('to-delete-1'));

          const found = repo.findById(SessionId('to-delete-1'));
          expect(found).toBeNull();
        })
      );
    });
  });

  describe('markOrphanedEnded', () => {
    it('transitions all active sessions to ended status', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const s1 = Session.create({ agentType: 'claude', cwd: '/tmp/orphan1' });
          const s2 = Session.create({ agentType: 'claude', cwd: '/tmp/orphan2' });
          repo.save(s1);
          repo.save(s2);

          repo.markOrphanedEnded();

          const s1After = repo.findById(s1.id);
          const s2After = repo.findById(s2.id);
          expect(s1After?.status).toBe('ended');
          expect(s2After?.status).toBe('ended');
          expect(s1After?.exitCode).toBe(-1);
        })
      );
    });
  });

  describe('pruneOld', () => {
    it('deletes ended sessions older than maxAgeMs', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const old = Session.reconstitute({
            id: 'prune-old-1',
            agentType: 'claude',
            cwd: '/tmp/old-prune',
            startedAt: Date.now() - 200_000,
            endedAt: Date.now() - 100_000,
            status: 'ended',
            resumable: false,
            mode: 'prompt',
          });
          const recent = Session.reconstitute({
            id: 'prune-recent-1',
            agentType: 'claude',
            cwd: '/tmp/recent-prune',
            startedAt: Date.now() - 2000,
            endedAt: Date.now() - 1000,
            status: 'ended',
            resumable: false,
            mode: 'prompt',
          });
          repo.save(old);
          repo.save(recent);

          repo.pruneOld(50_000);

          expect(repo.findById(SessionId('prune-old-1'))).toBeNull();
          expect(repo.findById(SessionId('prune-recent-1'))).not.toBeNull();
        })
      );
    });

    it('preserves active sessions regardless of age', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionStore;
          const active = Session.reconstitute({
            id: 'prune-active-1',
            agentType: 'claude',
            cwd: '/tmp/active-prune',
            startedAt: Date.now() - 200_000,
            status: 'active',
            resumable: false,
            mode: 'prompt',
          });
          repo.save(active);

          repo.pruneOld(50_000);

          expect(repo.findById(SessionId('prune-active-1'))).not.toBeNull();
        })
      );
    });
  });
});
