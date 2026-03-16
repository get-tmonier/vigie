import type { Database } from 'bun:sqlite';
import type { AgentSession } from '../../session/domain/session.js';

interface TerminalChunkRow {
  data: string;
  timestamp: number;
  seq: number;
}

interface InputHistoryRow {
  text: string;
  source: string;
  timestamp: number;
}

interface SessionRow {
  id: string;
  agent_type: string;
  mode: string;
  cwd: string;
  git_branch: string | null;
  git_remote_url: string | null;
  repo_name: string | null;
  started_at: number;
  ended_at: number | null;
  status: string;
  exit_code: number | null;
  claude_session_id: string | null;
  resumable: number;
}

export function createSessionStore(db: Database) {
  const upsertSessionStmt = db.prepare(`
    INSERT INTO sessions (id, agent_type, mode, cwd, git_branch, git_remote_url, repo_name, started_at, status)
    VALUES ($id, $agent_type, $mode, $cwd, $git_branch, $git_remote_url, $repo_name, $started_at, $status)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      ended_at = excluded.ended_at,
      exit_code = excluded.exit_code
  `);

  const markEndedStmt = db.prepare(`
    UPDATE sessions SET status = $status, ended_at = $ended_at, exit_code = $exit_code,
      resumable = (CASE WHEN agent_type = 'claude' AND claude_session_id IS NOT NULL AND $exit_code = 0 THEN 1 ELSE 0 END)
    WHERE id = $id
  `);

  const getActiveSessionsStmt = db.prepare(`
    SELECT * FROM sessions WHERE status = 'active'
  `);

  const getAllSessionsStmt = db.prepare(`
    SELECT * FROM sessions WHERE status IN ('active', 'ended', 'error')
  `);

  const getChunksStmt = db.prepare(`
    SELECT data, timestamp, seq FROM terminal_chunks
    WHERE session_id = $session_id
    ORDER BY seq DESC
    LIMIT $limit
  `);

  const appendChunkStmt = db.prepare(`
    INSERT INTO terminal_chunks (session_id, data, timestamp, seq)
    VALUES ($session_id, $data, $timestamp, $seq)
  `);

  const getMaxSeqStmt = db.prepare(`
    SELECT COALESCE(MAX(seq), 0) as max_seq FROM terminal_chunks WHERE session_id = $session_id
  `);

  const enqueueStmt = db.prepare(`
    INSERT INTO event_queue (payload, created_at) VALUES ($payload, $created_at)
  `);

  const drainQueueStmt = db.prepare(`
    SELECT id, payload FROM event_queue ORDER BY id ASC
  `);

  const deleteQueueItemStmt = db.prepare(`
    DELETE FROM event_queue WHERE id = $id
  `);

  const pruneSessionsStmt = db.prepare(`
    DELETE FROM sessions WHERE status IN ('ended', 'error') AND ended_at < $cutoff
  `);

  const pruneChunksStmt = db.prepare(`
    DELETE FROM terminal_chunks WHERE session_id NOT IN (SELECT id FROM sessions)
  `);

  const appendInputEntryStmt = db.prepare(`
    INSERT INTO input_history (session_id, text, source, timestamp)
    VALUES ($session_id, $text, $source, $timestamp)
  `);

  const getInputHistoryStmt = db.prepare(`
    SELECT text, source, timestamp FROM input_history
    WHERE session_id = $session_id
    ORDER BY timestamp ASC
    LIMIT $limit
  `);

  const pruneInputHistoryStmt = db.prepare(`
    DELETE FROM input_history WHERE session_id NOT IN (SELECT id FROM sessions)
  `);

  const updateClaudeSessionIdStmt = db.prepare(
    'UPDATE sessions SET claude_session_id = $claude_session_id WHERE id = $id'
  );

  const getSessionByIdStmt = db.prepare('SELECT * FROM sessions WHERE id = $id');

  const reactivateSessionStmt = db.prepare(
    "UPDATE sessions SET status = 'active', ended_at = NULL, exit_code = NULL WHERE id = $id"
  );

  const markOrphanedStmt = db.prepare(`
    UPDATE sessions SET status = 'ended', ended_at = $now, exit_code = -1 WHERE status = 'active'
  `);

  return {
    upsertSession(session: AgentSession, mode: string = 'prompt') {
      upsertSessionStmt.run({
        $id: session.id,
        $agent_type: session.agentType,
        $mode: mode,
        $cwd: session.cwd,
        $git_branch: session.gitBranch ?? null,
        $git_remote_url: session.gitRemoteUrl ?? null,
        $repo_name: session.repoName ?? null,
        $started_at: session.startedAt,
        $status: session.status,
      });
    },

    markSessionEnded(sessionId: string, status: 'ended' | 'error', exitCode: number): boolean {
      markEndedStmt.run({
        $id: sessionId,
        $status: status,
        $ended_at: Date.now(),
        $exit_code: exitCode,
      });
      const row = getSessionByIdStmt.get({ $id: sessionId }) as SessionRow | null;
      return row?.resumable === 1;
    },

    appendTerminalChunk(sessionId: string, data: string, timestamp: number) {
      const row = getMaxSeqStmt.get({ $session_id: sessionId }) as { max_seq: number };
      const seq = row.max_seq + 1;
      appendChunkStmt.run({
        $session_id: sessionId,
        $data: data,
        $timestamp: timestamp,
        $seq: seq,
      });
    },

    getTerminalChunks(sessionId: string, limit: number = 500): TerminalChunkRow[] {
      const rows = getChunksStmt.all({
        $session_id: sessionId,
        $limit: limit,
      }) as TerminalChunkRow[];
      return rows.reverse();
    },

    getActiveSessions(): SessionRow[] {
      return getActiveSessionsStmt.all() as SessionRow[];
    },

    getAllSessions(): SessionRow[] {
      return getAllSessionsStmt.all() as SessionRow[];
    },

    enqueue(payload: unknown) {
      enqueueStmt.run({
        $payload: JSON.stringify(payload),
        $created_at: Date.now(),
      });
    },

    drainQueue(): Array<{ id: number; payload: unknown }> {
      const rows = drainQueueStmt.all() as Array<{ id: number; payload: string }>;
      return rows.map((row) => ({
        id: row.id,
        payload: JSON.parse(row.payload),
      }));
    },

    deleteQueueItem(id: number) {
      deleteQueueItemStmt.run({ $id: id });
    },

    markOrphanedSessionsEnded() {
      markOrphanedStmt.run({ $now: Date.now() });
    },

    updateClaudeSessionId(sessionId: string, claudeSessionId: string) {
      updateClaudeSessionIdStmt.run({
        $id: sessionId,
        $claude_session_id: claudeSessionId,
      });
    },

    getSession(sessionId: string): AgentSession | null {
      const row = getSessionByIdStmt.get({ $id: sessionId }) as SessionRow | null;
      if (!row) return null;
      return {
        id: row.id,
        agentType: row.agent_type as AgentSession['agentType'],
        cwd: row.cwd,
        gitBranch: row.git_branch ?? undefined,
        gitRemoteUrl: row.git_remote_url ?? undefined,
        repoName: row.repo_name ?? undefined,
        startedAt: row.started_at,
        status: row.status as AgentSession['status'],
      };
    },

    getSessionById(sessionId: string): SessionRow | null {
      return getSessionByIdStmt.get({ $id: sessionId }) as SessionRow | null;
    },

    reactivateSession(sessionId: string) {
      reactivateSessionStmt.run({ $id: sessionId });
    },

    deleteSessionById(sessionId: string) {
      db.prepare('DELETE FROM input_history WHERE session_id = $id').run({ $id: sessionId });
      db.prepare('DELETE FROM terminal_chunks WHERE session_id = $id').run({ $id: sessionId });
      db.prepare('DELETE FROM sessions WHERE id = $id').run({ $id: sessionId });
    },

    deleteEndedSessions() {
      db.run(
        "DELETE FROM input_history WHERE session_id IN (SELECT id FROM sessions WHERE status IN ('ended', 'error'))"
      );
      db.run(
        "DELETE FROM terminal_chunks WHERE session_id IN (SELECT id FROM sessions WHERE status IN ('ended', 'error'))"
      );
      db.run("DELETE FROM sessions WHERE status IN ('ended', 'error')");
    },

    setResumable(sessionId: string, resumable: boolean) {
      db.prepare('UPDATE sessions SET resumable = $resumable WHERE id = $id').run({
        $id: sessionId,
        $resumable: resumable ? 1 : 0,
      });
    },

    getActiveClaudeSessionsWithId(): Array<{
      id: string;
      claude_session_id: string;
      cwd: string;
      resumable: number;
    }> {
      return db
        .prepare(
          "SELECT id, claude_session_id, cwd, resumable FROM sessions WHERE status = 'active' AND agent_type = 'claude' AND claude_session_id IS NOT NULL"
        )
        .all() as Array<{ id: string; claude_session_id: string; cwd: string; resumable: number }>;
    },

    recomputeResumable(fileExists: (claudeSessionId: string, cwd: string) => boolean) {
      const rows = db
        .prepare(
          "SELECT id, claude_session_id, cwd FROM sessions WHERE agent_type = 'claude' AND claude_session_id IS NOT NULL"
        )
        .all() as Array<{ id: string; claude_session_id: string; cwd: string }>;
      for (const row of rows) {
        const resumable = fileExists(row.claude_session_id, row.cwd) ? 1 : 0;
        db.prepare('UPDATE sessions SET resumable = $resumable WHERE id = $id').run({
          $id: row.id,
          $resumable: resumable,
        });
      }
    },

    pruneOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000) {
      const cutoff = Date.now() - maxAgeMs;
      pruneSessionsStmt.run({ $cutoff: cutoff });
      pruneChunksStmt.run();
      pruneInputHistoryStmt.run();
    },

    appendInputEntry(sessionId: string, text: string, source: string, timestamp: number) {
      appendInputEntryStmt.run({
        $session_id: sessionId,
        $text: text,
        $source: source,
        $timestamp: timestamp,
      });
    },

    getInputHistory(sessionId: string, limit: number = 200): InputHistoryRow[] {
      return getInputHistoryStmt.all({
        $session_id: sessionId,
        $limit: limit,
      }) as InputHistoryRow[];
    },
  };
}
