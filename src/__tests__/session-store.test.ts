import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { openDatabase } from '../modules/daemon/persistence/database.js';
import { createSessionStore } from '../modules/daemon/persistence/session-store.js';
import type { AgentSession } from '../modules/session/domain/session.js';

const db = openDatabase(':memory:');
const store = createSessionStore(db);

const baseSession: AgentSession = {
  id: 'session-1',
  agentType: 'claude',
  cwd: '/home/user/project',
  startedAt: 1_000_000,
  status: 'active',
};

beforeEach(() => {
  db.run('DELETE FROM terminal_chunks');
  db.run('DELETE FROM event_queue');
  db.run('DELETE FROM sessions');
});

afterAll(() => {
  db.close();
});

describe('session-store', () => {
  describe('upsertSession', () => {
    it('inserts a new session', () => {
      store.upsertSession(baseSession, 'interactive');
      const rows = store.getActiveSessions();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('session-1');
      expect(rows[0].agent_type).toBe('claude');
      expect(rows[0].mode).toBe('interactive');
      expect(rows[0].cwd).toBe('/home/user/project');
      expect(rows[0].status).toBe('active');
    });

    it('preserves optional git fields', () => {
      const session: AgentSession = {
        ...baseSession,
        gitBranch: 'main',
        gitRemoteUrl: 'git@github.com:user/repo.git',
        repoName: 'my-repo',
      };
      store.upsertSession(session, 'prompt');
      const rows = store.getActiveSessions();
      expect(rows[0].git_branch).toBe('main');
      expect(rows[0].git_remote_url).toBe('git@github.com:user/repo.git');
      expect(rows[0].repo_name).toBe('my-repo');
    });

    it('does not duplicate on re-insert', () => {
      store.upsertSession(baseSession, 'prompt');
      store.upsertSession(baseSession, 'prompt');
      const rows = store.getActiveSessions();
      expect(rows).toHaveLength(1);
    });
  });

  describe('markSessionEnded', () => {
    it('updates status and exit code', () => {
      store.upsertSession(baseSession, 'prompt');
      store.markSessionEnded('session-1', 'ended', 0);
      const rows = store.getAllSessions();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('ended');
      expect(rows[0].exit_code).toBe(0);
      expect(rows[0].ended_at).toBeGreaterThan(0);
    });

    it('marks error status', () => {
      store.upsertSession(baseSession, 'prompt');
      store.markSessionEnded('session-1', 'error', -1);
      const rows = store.getAllSessions();
      expect(rows[0].status).toBe('error');
      expect(rows[0].exit_code).toBe(-1);
    });
  });

  describe('terminal chunks', () => {
    it('appends and retrieves chunks in order', () => {
      store.upsertSession(baseSession, 'interactive');
      store.appendTerminalChunk('session-1', 'chunk-a', 100);
      store.appendTerminalChunk('session-1', 'chunk-b', 200);
      store.appendTerminalChunk('session-1', 'chunk-c', 300);

      const chunks = store.getTerminalChunks('session-1');
      expect(chunks).toHaveLength(3);
      expect(chunks[0].data).toBe('chunk-a');
      expect(chunks[0].seq).toBe(1);
      expect(chunks[1].data).toBe('chunk-b');
      expect(chunks[1].seq).toBe(2);
      expect(chunks[2].data).toBe('chunk-c');
      expect(chunks[2].seq).toBe(3);
    });

    it('respects limit parameter', () => {
      store.upsertSession(baseSession, 'interactive');
      for (let i = 0; i < 10; i++) {
        store.appendTerminalChunk('session-1', `chunk-${i}`, i * 100);
      }

      const chunks = store.getTerminalChunks('session-1', 3);
      expect(chunks).toHaveLength(3);
      // Should return the LAST 3 chunks (most recent)
      expect(chunks[0].data).toBe('chunk-7');
      expect(chunks[1].data).toBe('chunk-8');
      expect(chunks[2].data).toBe('chunk-9');
    });
  });

  describe('event queue', () => {
    it('enqueues and drains in FIFO order', () => {
      store.enqueue({ type: 'session:started', sessionId: 's-1' });
      store.enqueue({ type: 'session:ended', sessionId: 's-1' });

      const items = store.drainQueue();
      expect(items).toHaveLength(2);
      expect((items[0].payload as { type: string }).type).toBe('session:started');
      expect((items[1].payload as { type: string }).type).toBe('session:ended');
    });

    it('deleteQueueItem removes a specific item', () => {
      store.enqueue({ type: 'msg-1' });
      store.enqueue({ type: 'msg-2' });

      const items = store.drainQueue();
      store.deleteQueueItem(items[0].id);

      const remaining = store.drainQueue();
      expect(remaining).toHaveLength(1);
      expect((remaining[0].payload as { type: string }).type).toBe('msg-2');
    });
  });

  describe('markOrphanedSessionsEnded', () => {
    it('marks all active sessions as ended', () => {
      store.upsertSession(baseSession, 'prompt');
      store.upsertSession({ ...baseSession, id: 'session-2' }, 'interactive');

      store.markOrphanedSessionsEnded();

      const active = store.getActiveSessions();
      expect(active).toHaveLength(0);

      const all = store.getAllSessions();
      expect(all).toHaveLength(2);
      expect(all[0].status).toBe('ended');
      expect(all[1].status).toBe('ended');
    });
  });

  describe('pruneOldSessions', () => {
    it('removes ended sessions older than max age', () => {
      store.upsertSession(baseSession, 'prompt');
      store.markSessionEnded('session-1', 'ended', 0);

      // Manually set ended_at to an old timestamp
      db.run('UPDATE sessions SET ended_at = 1 WHERE id = ?', ['session-1']);

      store.appendTerminalChunk('session-1', 'old-chunk', 1);

      store.pruneOldSessions(1000);

      const all = store.getAllSessions();
      expect(all).toHaveLength(0);

      // Terminal chunks should also be cleaned up
      const chunks = store.getTerminalChunks('session-1');
      expect(chunks).toHaveLength(0);
    });

    it('preserves active sessions', () => {
      store.upsertSession(baseSession, 'prompt');
      store.pruneOldSessions(0);

      const all = store.getActiveSessions();
      expect(all).toHaveLength(1);
    });
  });
});

describe('openDatabase', () => {
  it('creates all required tables', () => {
    const testDb = openDatabase(':memory:');

    // Verify tables exist by inserting
    testDb.run(
      "INSERT INTO sessions (id, agent_type, cwd, started_at, status) VALUES ('t', 'claude', '/', 0, 'active')"
    );
    testDb.run(
      "INSERT INTO terminal_chunks (session_id, data, timestamp, seq) VALUES ('t', 'd', 0, 1)"
    );
    testDb.run("INSERT INTO event_queue (payload, created_at) VALUES ('{}', 0)");
    testDb.close();
  });
});
