import type { Database } from 'bun:sqlite';
import { Effect, Layer } from 'effect';
import { VigiDatabase } from '#infra/database';
import {
  type ResumableSessionInfo,
  SessionRepository,
  type SessionRepositoryShape,
} from '#modules/session/application/ports/out/session-repository.port';
import { Session } from '#modules/session/domain/session';
import type { SessionId } from '#modules/session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/session/domain/session-id';
import type { SessionStatus } from '#modules/session/domain/session-status';

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
  agent_session_id: string | null;
  resumable: number;
}

function rowToSession(row: SessionRow): Session {
  return Session.reconstitute({
    id: row.id,
    agentType: row.agent_type,
    cwd: row.cwd,
    gitBranch: row.git_branch ?? undefined,
    gitRemoteUrl: row.git_remote_url ?? undefined,
    repoName: row.repo_name ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    status: row.status as SessionStatus,
    exitCode: row.exit_code ?? undefined,
    agentSessionId: row.agent_session_id ?? undefined,
    resumable: row.resumable === 1,
    mode: row.mode,
  });
}

export function createSqliteSessionRepository(db: Database): SessionRepositoryShape {
  const upsertStmt = db.prepare(`
    INSERT INTO sessions (id, agent_type, mode, cwd, git_branch, git_remote_url, repo_name, started_at, ended_at, status, exit_code, agent_session_id, resumable)
    VALUES ($id, $agent_type, $mode, $cwd, $git_branch, $git_remote_url, $repo_name, $started_at, $ended_at, $status, $exit_code, $agent_session_id, $resumable)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      ended_at = excluded.ended_at,
      exit_code = excluded.exit_code,
      agent_session_id = excluded.agent_session_id,
      resumable = excluded.resumable
  `);

  const findByIdStmt = db.prepare('SELECT * FROM sessions WHERE id = $id');
  const findAllStmt = db.prepare(
    "SELECT * FROM sessions WHERE status IN ('active', 'ended', 'error')"
  );
  const findActiveStmt = db.prepare("SELECT * FROM sessions WHERE status = 'active'");
  const markOrphanedStmt = db.prepare(
    "UPDATE sessions SET status = 'ended', ended_at = $now, exit_code = -1 WHERE status = 'active'"
  );
  const pruneSessionsStmt = db.prepare(
    "DELETE FROM sessions WHERE status IN ('ended', 'error') AND ended_at < $cutoff"
  );
  const pruneChunksStmt = db.prepare(
    'DELETE FROM terminal_chunks WHERE session_id NOT IN (SELECT id FROM sessions)'
  );
  const pruneInputStmt = db.prepare(
    'DELETE FROM input_history WHERE session_id NOT IN (SELECT id FROM sessions)'
  );

  return {
    findById(id: SessionId): Session | null {
      const row = findByIdStmt.get({ $id: id }) as SessionRow | null;
      return row ? rowToSession(row) : null;
    },

    findAll(): Session[] {
      return (findAllStmt.all() as SessionRow[]).map(rowToSession);
    },

    findActive(): Session[] {
      return (findActiveStmt.all() as SessionRow[]).map(rowToSession);
    },

    findActiveWithAgentId(): ResumableSessionInfo[] {
      const rows = db
        .prepare(
          "SELECT id, agent_session_id, cwd, resumable FROM sessions WHERE status = 'active' AND agent_session_id IS NOT NULL"
        )
        .all() as Array<{ id: string; agent_session_id: string; cwd: string; resumable: number }>;
      return rows.map((r) => ({
        id: makeSessionId(r.id),
        agentSessionId: r.agent_session_id,
        cwd: r.cwd,
        resumable: r.resumable === 1,
      }));
    },

    findRecentlyEnded(withinMs: number): ResumableSessionInfo[] {
      const cutoff = Date.now() - withinMs;
      const rows = db
        .prepare(
          "SELECT id, agent_session_id, cwd, resumable FROM sessions WHERE status = 'ended' AND agent_session_id IS NOT NULL AND ended_at > $cutoff AND resumable = 0"
        )
        .all({ $cutoff: cutoff }) as Array<{
        id: string;
        agent_session_id: string;
        cwd: string;
        resumable: number;
      }>;
      return rows.map((r) => ({
        id: makeSessionId(r.id),
        agentSessionId: r.agent_session_id,
        cwd: r.cwd,
        resumable: r.resumable === 1,
      }));
    },

    save(session: Session): void {
      upsertStmt.run({
        $id: session.id,
        $agent_type: session.agentType,
        $mode: session.mode,
        $cwd: session.cwd,
        $git_branch: session.gitBranch ?? null,
        $git_remote_url: session.gitRemoteUrl ?? null,
        $repo_name: session.repoName ?? null,
        $started_at: session.startedAt,
        $ended_at: session.endedAt ?? null,
        $status: session.status,
        $exit_code: session.exitCode ?? null,
        $agent_session_id: session.agentSessionId ?? null,
        $resumable: session.resumable ? 1 : 0,
      });
    },

    delete(id: SessionId): void {
      db.prepare('DELETE FROM input_history WHERE session_id = $id').run({ $id: id });
      db.prepare('DELETE FROM terminal_chunks WHERE session_id = $id').run({ $id: id });
      db.prepare('DELETE FROM sessions WHERE id = $id').run({ $id: id });
    },

    deleteAllEnded(): void {
      db.run(
        "DELETE FROM input_history WHERE session_id IN (SELECT id FROM sessions WHERE status IN ('ended', 'error'))"
      );
      db.run(
        "DELETE FROM terminal_chunks WHERE session_id IN (SELECT id FROM sessions WHERE status IN ('ended', 'error'))"
      );
      db.run("DELETE FROM sessions WHERE status IN ('ended', 'error')");
    },

    markOrphanedEnded(): void {
      markOrphanedStmt.run({ $now: Date.now() });
    },

    pruneOld(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
      const cutoff = Date.now() - maxAgeMs;
      pruneSessionsStmt.run({ $cutoff: cutoff });
      pruneChunksStmt.run();
      pruneInputStmt.run();
    },
  };
}

export const SqliteSessionRepositoryLayer = Layer.effect(SessionRepository)(
  Effect.gen(function* () {
    const db = yield* VigiDatabase;
    return createSqliteSessionRepository(db);
  })
);
