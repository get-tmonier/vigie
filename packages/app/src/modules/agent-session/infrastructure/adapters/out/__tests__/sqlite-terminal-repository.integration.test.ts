import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Kysely } from 'kysely';
import { SessionLog } from '#modules/agent-session/application/ports/out/session-log.port';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import { VigiDatabase, type VigiDatabaseServices } from '#shared/db/database';
import { createBunSqliteDialect } from '#shared/db/dialect';
import type { VigiDatabaseSchema } from '#shared/db/schema';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';

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
      resumable INTEGER NOT NULL DEFAULT 0
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
  // Insert a seed session so foreign key constraints are satisfied
  sqlite.run(
    `INSERT INTO sessions (id, agent_type, mode, cwd, started_at, status) VALUES ('session-1', 'claude', 'interactive', '/tmp/test', ${Date.now()}, 'active')`
  );
  const kysely = new Kysely<VigiDatabaseSchema>({ dialect: createBunSqliteDialect(sqlite) });
  return { sqlite, kysely };
}

const TestDatabaseLayer = Layer.sync(VigiDatabase)(() => makeTestDb());
const TestRepoLayer = SqliteTerminalRepositoryLive.pipe(Layer.provide(TestDatabaseLayer));

async function runWithRepo<A>(effect: Effect.Effect<A, never, SessionLog>): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, TestRepoLayer));
}

const SESSION_ID = makeSessionId('session-1');
const UNKNOWN_ID = makeSessionId('nonexistent-session');

describe('SqliteTerminalRepository', () => {
  describe('appendChunk + getChunks', () => {
    it('appends a chunk and retrieves it', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendChunk(SESSION_ID, 'hello world', now);

          const chunks = repo.getChunks(SESSION_ID);
          expect(chunks.length).toBe(1);
          expect(chunks[0].data).toBe('hello world');
          expect(chunks[0].timestamp).toBe(now);
          expect(chunks[0].seq).toBe(1);
        })
      );
    });

    it('assigns sequential seq numbers across multiple appends', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendChunk(SESSION_ID, 'chunk-a', now);
          repo.appendChunk(SESSION_ID, 'chunk-b', now + 1);
          repo.appendChunk(SESSION_ID, 'chunk-c', now + 2);

          const chunks = repo.getChunks(SESSION_ID);
          expect(chunks.length).toBe(3);
          const seqs = chunks.map((c) => c.seq).sort((a, b) => a - b);
          expect(seqs).toEqual([1, 2, 3]);
        })
      );
    });

    it('returns chunks in ascending order', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendChunk(SESSION_ID, 'first', now);
          repo.appendChunk(SESSION_ID, 'second', now + 1);

          const chunks = repo.getChunks(SESSION_ID);
          expect(chunks[0].data).toBe('first');
          expect(chunks[1].data).toBe('second');
        })
      );
    });

    it('respects the limit parameter', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendChunk(SESSION_ID, 'a', now);
          repo.appendChunk(SESSION_ID, 'b', now + 1);
          repo.appendChunk(SESSION_ID, 'c', now + 2);

          const limited = repo.getChunks(SESSION_ID, 2);
          expect(limited.length).toBe(2);
        })
      );
    });

    it('returns empty array for unknown session', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const chunks = repo.getChunks(UNKNOWN_ID);
          expect(chunks).toEqual([]);
        })
      );
    });
  });

  describe('getAllChunks', () => {
    it('returns all chunks in ascending seq order', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendChunk(SESSION_ID, 'x', now);
          repo.appendChunk(SESSION_ID, 'y', now + 1);
          repo.appendChunk(SESSION_ID, 'z', now + 2);

          const all = repo.getAllChunks(SESSION_ID);
          expect(all.length).toBe(3);
          expect(all[0].data).toBe('x');
          expect(all[1].data).toBe('y');
          expect(all[2].data).toBe('z');
        })
      );
    });

    it('returns empty array when no chunks exist', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const all = repo.getAllChunks(UNKNOWN_ID);
          expect(all).toEqual([]);
        })
      );
    });
  });

  describe('appendInput + getInputHistory', () => {
    it('appends an input entry and retrieves it', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendInput(SESSION_ID, 'ls -la', 'cli', now);

          const history = repo.getInputHistory(SESSION_ID);
          expect(history.length).toBe(1);
          expect(history[0].text).toBe('ls -la');
          expect(history[0].source).toBe('cli');
          expect(history[0].timestamp).toBe(now);
        })
      );
    });

    it('returns entries in ascending timestamp order', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendInput(SESSION_ID, 'first-cmd', 'cli', now);
          repo.appendInput(SESSION_ID, 'second-cmd', 'paste', now + 1);

          const history = repo.getInputHistory(SESSION_ID);
          expect(history.length).toBe(2);
          expect(history[0].text).toBe('first-cmd');
          expect(history[1].text).toBe('second-cmd');
          expect(history[1].source).toBe('paste');
        })
      );
    });

    it('respects the limit parameter', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const now = Date.now();

          repo.appendInput(SESSION_ID, 'cmd1', 'cli', now);
          repo.appendInput(SESSION_ID, 'cmd2', 'cli', now + 1);
          repo.appendInput(SESSION_ID, 'cmd3', 'cli', now + 2);

          const limited = repo.getInputHistory(SESSION_ID, 2);
          expect(limited.length).toBe(2);
        })
      );
    });

    it('returns empty array for unknown session', async () => {
      await runWithRepo(
        Effect.gen(function* () {
          const repo = yield* SessionLog;
          const history = repo.getInputHistory(UNKNOWN_ID);
          expect(history).toEqual([]);
        })
      );
    });
  });
});
