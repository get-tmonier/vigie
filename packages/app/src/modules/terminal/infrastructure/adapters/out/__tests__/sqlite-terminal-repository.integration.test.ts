import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { openDatabase } from '#infra/database';
import { createSqliteTerminalRepository } from '../sqlite-terminal-repository';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  // Insert a dummy session row since terminal_chunks and input_history have FK constraints
  db.run(
    "INSERT INTO sessions (id, agent_type, mode, cwd, started_at, status, resumable) VALUES ('s1', 'claude', 'interactive', '/tmp', 0, 'active', 0)"
  );
  db.run(
    "INSERT INTO sessions (id, agent_type, mode, cwd, started_at, status, resumable) VALUES ('s2', 'aider', 'prompt', '/tmp', 0, 'active', 0)"
  );
});

afterEach(() => {
  db.close();
});

describe('SqliteTerminalRepository', () => {
  describe('appendChunk + getAllChunks', () => {
    it('returns chunks in ascending seq order', () => {
      const repo = createSqliteTerminalRepository(db);
      repo.appendChunk('s1', btoa('hello'), 100);
      repo.appendChunk('s1', btoa(' world'), 200);
      const chunks = repo.getAllChunks('s1');
      expect(chunks).toHaveLength(2);
      expect(chunks[0].seq).toBe(1);
      expect(chunks[1].seq).toBe(2);
    });

    it('auto-increments seq per session', () => {
      const repo = createSqliteTerminalRepository(db);
      repo.appendChunk('s1', btoa('a'), 1);
      repo.appendChunk('s1', btoa('b'), 2);
      repo.appendChunk('s1', btoa('c'), 3);
      const chunks = repo.getAllChunks('s1');
      expect(chunks.map((c) => c.seq)).toEqual([1, 2, 3]);
    });

    it('returns empty for session with no chunks', () => {
      const repo = createSqliteTerminalRepository(db);
      expect(repo.getAllChunks('s1')).toEqual([]);
    });
  });

  describe('getChunks with limit', () => {
    it('returns last N chunks in ascending order', () => {
      const repo = createSqliteTerminalRepository(db);
      repo.appendChunk('s1', btoa('a'), 1);
      repo.appendChunk('s1', btoa('b'), 2);
      repo.appendChunk('s1', btoa('c'), 3);
      repo.appendChunk('s1', btoa('d'), 4);
      const chunks = repo.getChunks('s1', 2);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].seq).toBe(3);
      expect(chunks[1].seq).toBe(4);
    });
  });

  describe('appendInput + getInputHistory', () => {
    it('returns entries in ascending timestamp order', () => {
      const repo = createSqliteTerminalRepository(db);
      repo.appendInput('s1', 'hello', 'cli', 100);
      repo.appendInput('s1', 'world', 'browser', 200);
      const history = repo.getInputHistory('s1');
      expect(history).toHaveLength(2);
      expect(history[0].text).toBe('hello');
      expect(history[0].source).toBe('cli');
      expect(history[1].text).toBe('world');
      expect(history[1].source).toBe('browser');
    });

    it('getInputHistory respects limit', () => {
      const repo = createSqliteTerminalRepository(db);
      for (let i = 0; i < 10; i++) {
        repo.appendInput('s1', `cmd${i}`, 'cli', i * 100);
      }
      const history = repo.getInputHistory('s1', 3);
      expect(history).toHaveLength(3);
    });
  });

  describe('multi-session isolation', () => {
    it('chunks for session A are not visible from session B', () => {
      const repo = createSqliteTerminalRepository(db);
      repo.appendChunk('s1', btoa('s1-data'), 1);
      repo.appendChunk('s2', btoa('s2-data'), 2);
      expect(repo.getAllChunks('s1')).toHaveLength(1);
      expect(repo.getAllChunks('s2')).toHaveLength(1);
    });

    it('input history for session A is not visible from session B', () => {
      const repo = createSqliteTerminalRepository(db);
      repo.appendInput('s1', 'cmd-a', 'cli', 1);
      repo.appendInput('s2', 'cmd-b', 'cli', 2);
      expect(repo.getInputHistory('s1')).toHaveLength(1);
      expect(repo.getInputHistory('s2')).toHaveLength(1);
    });
  });
});
