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
      store.markSessionEnded('session-1', 'ended', 0, false);
      const rows = store.getAllSessions();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('ended');
      expect(rows[0].exit_code).toBe(0);
      expect(rows[0].ended_at).toBeGreaterThan(0);
    });

    it('marks error status', () => {
      store.upsertSession(baseSession, 'prompt');
      store.markSessionEnded('session-1', 'error', -1, false);
      const rows = store.getAllSessions();
      expect(rows[0].status).toBe('error');
      expect(rows[0].exit_code).toBe(-1);
    });

    it('stores resumable=true when passed true', () => {
      store.upsertSession(baseSession, 'interactive');
      const result = store.markSessionEnded('session-1', 'ended', 0, true);
      expect(result).toBe(true);
      const rows = store.getAllSessions();
      expect(rows[0].resumable).toBe(1);
    });

    it('stores resumable=false when passed false', () => {
      store.upsertSession(baseSession, 'interactive');
      const result = store.markSessionEnded('session-1', 'ended', 143, false);
      expect(result).toBe(false);
      const rows = store.getAllSessions();
      expect(rows[0].resumable).toBe(0);
    });

    it('resumable=true even with non-zero exit code (SIGTERM)', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      const result = store.markSessionEnded('session-1', 'ended', 143, true);
      expect(result).toBe(true);
      const rows = store.getAllSessions();
      expect(rows[0].resumable).toBe(1);
    });

    it('resumable=false even with exit code 0', () => {
      store.upsertSession(baseSession, 'interactive');
      const result = store.markSessionEnded('session-1', 'ended', 0, false);
      expect(result).toBe(false);
      const rows = store.getAllSessions();
      expect(rows[0].resumable).toBe(0);
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

  describe('getActiveClaudeSessionsWithId', () => {
    it('returns only active claude sessions with a claude_session_id', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.upsertSession({ ...baseSession, id: 'session-2' }, 'interactive');
      // session-2 has no claude_session_id

      const rows = store.getActiveClaudeSessionsWithId();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('session-1');
      expect(rows[0].claude_session_id).toBe('claude-abc');
    });

    it('excludes ended sessions', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, true);

      const rows = store.getActiveClaudeSessionsWithId();
      expect(rows).toHaveLength(0);
    });

    it('excludes non-claude agent types', () => {
      const nonClaude: AgentSession = { ...baseSession, id: 'session-2', agentType: 'generic' };
      store.upsertSession(nonClaude, 'interactive');
      db.run("UPDATE sessions SET claude_session_id = 'some-id' WHERE id = 'session-2'");

      const rows = store.getActiveClaudeSessionsWithId();
      expect(rows).toHaveLength(0);
    });
  });

  describe('setResumable', () => {
    it('updates resumable to true', () => {
      store.upsertSession(baseSession, 'interactive');
      store.markSessionEnded('session-1', 'ended', 0, false);
      store.setResumable('session-1', true);

      const row = store.getSessionById('session-1');
      expect(row?.resumable).toBe(1);
    });

    it('updates resumable to false', () => {
      store.upsertSession(baseSession, 'interactive');
      store.markSessionEnded('session-1', 'ended', 0, true);
      store.setResumable('session-1', false);

      const row = store.getSessionById('session-1');
      expect(row?.resumable).toBe(0);
    });
  });

  describe('getRecentlyEndedClaudeSessionsWithId', () => {
    it('returns recently ended claude sessions with resumable=0', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, false);

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('session-1');
      expect(rows[0].claude_session_id).toBe('claude-abc');
      expect(rows[0].resumable).toBe(0);
    });

    it('excludes sessions already marked resumable', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, true);

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(0);
    });

    it('excludes active sessions', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(0);
    });

    it('excludes sessions ended before the time window', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, false);
      // Backdate ended_at to well outside the window
      db.run('UPDATE sessions SET ended_at = 1 WHERE id = ?', ['session-1']);

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(0);
    });

    it('excludes sessions with no claude_session_id', () => {
      store.upsertSession(baseSession, 'interactive');
      // No updateClaudeSessionId call
      store.markSessionEnded('session-1', 'ended', 0, false);

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(0);
    });

    it('excludes non-claude agent types', () => {
      const nonClaude: AgentSession = { ...baseSession, id: 'session-2', agentType: 'generic' };
      store.upsertSession(nonClaude, 'interactive');
      db.run(
        `UPDATE sessions SET claude_session_id = 'claude-xyz', ended_at = ${Date.now()}, status = 'ended', resumable = 0 WHERE id = 'session-2'`
      );

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(0);
    });

    it('only returns sessions within the specified time window', () => {
      // Session 1: ended recently
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, false);

      // Session 2: ended a long time ago
      store.upsertSession({ ...baseSession, id: 'session-2' }, 'interactive');
      store.updateClaudeSessionId('session-2', 'claude-def');
      store.markSessionEnded('session-2', 'ended', 0, false);
      db.run('UPDATE sessions SET ended_at = 1 WHERE id = ?', ['session-2']);

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('session-1');
    });

    it('returns correct cwd for resumed safety-net check', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, false);

      const rows = store.getRecentlyEndedClaudeSessionsWithId(60_000);
      expect(rows[0].cwd).toBe('/home/user/project');
    });
  });

  describe('onDisconnect resumable guard (Bug 2 regression)', () => {
    // These tests simulate the state transitions that exposed Bug 2:
    // Ctrl+C → PTY exits → markSessionEnded(resumable=true) → PTY deleted
    // → onDisconnect fires → previously overwrote resumable=true with false

    it('getSessionById returns ended status after markSessionEnded', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');
      store.markSessionEnded('session-1', 'ended', 0, true);

      const row = store.getSessionById('session-1');
      expect(row?.status).toBe('ended');
    });

    it('alreadyEnded is true when session status is ended', () => {
      store.upsertSession(baseSession, 'interactive');
      store.markSessionEnded('session-1', 'ended', 0, true);

      const row = store.getSessionById('session-1');
      const alreadyEnded = row?.status === 'ended' || row?.status === 'error';
      expect(alreadyEnded).toBe(true);
    });

    it('alreadyEnded is true when session status is error', () => {
      store.upsertSession(baseSession, 'interactive');
      store.markSessionEnded('session-1', 'error', -1, false);

      const row = store.getSessionById('session-1');
      const alreadyEnded = row?.status === 'ended' || row?.status === 'error';
      expect(alreadyEnded).toBe(true);
    });

    it('alreadyEnded is false for active session (non-interactive disconnect path)', () => {
      store.upsertSession(baseSession, 'interactive');
      // Session still active — no markSessionEnded called yet

      const row = store.getSessionById('session-1');
      const alreadyEnded = row?.status === 'ended' || row?.status === 'error';
      expect(alreadyEnded).toBe(false);
    });

    it('calling markSessionEnded with resumable=false after resumable=true overwrites it (demonstrates the bug)', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');

      // Step 1: PTY exits, session marked resumable=true
      store.markSessionEnded('session-1', 'ended', 0, true);
      expect(store.getSessionById('session-1')?.resumable).toBe(1);

      // Step 2: Without the guard, onDisconnect would overwrite with resumable=false
      store.markSessionEnded('session-1', 'ended', -1, false);
      expect(store.getSessionById('session-1')?.resumable).toBe(0); // Bug: now wrong
    });

    it('skipping markSessionEnded when alreadyEnded preserves resumable=true (demonstrates the fix)', () => {
      store.upsertSession(baseSession, 'interactive');
      store.updateClaudeSessionId('session-1', 'claude-abc');

      // Step 1: PTY exits, session marked resumable=true
      store.markSessionEnded('session-1', 'ended', 0, true);

      // Step 2: onDisconnect fires — check alreadyEnded before calling markSessionEnded
      const row = store.getSessionById('session-1');
      const alreadyEnded = row?.status === 'ended' || row?.status === 'error';

      if (!alreadyEnded) {
        store.markSessionEnded('session-1', 'ended', -1, false);
      }

      // resumable is preserved because we skipped the overwrite
      expect(store.getSessionById('session-1')?.resumable).toBe(1);
    });
  });

  describe('pruneOldSessions', () => {
    it('removes ended sessions older than max age', () => {
      store.upsertSession(baseSession, 'prompt');
      store.markSessionEnded('session-1', 'ended', 0, false);

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
