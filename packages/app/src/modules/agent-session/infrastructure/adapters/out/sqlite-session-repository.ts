import type { Database } from 'bun:sqlite';
import { Effect, Layer } from 'effect';
import * as v from 'valibot';
import {
  type ResumableSessionInfo,
  SessionStore,
  type SessionStoreShape,
} from '#modules/agent-session/application/ports/out/session-store.port';
import { Session } from '#modules/agent-session/domain/session';
import type { SessionStatus } from '#modules/agent-session/domain/session-status';
import { VigiDatabase } from '#shared/db/database';
import { type AgentType, AgentTypeSchema } from '#shared/kernel/session/agent-type';
import type { SessionId } from '#shared/kernel/session/session-id';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';

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
  session_type: string | null;
  auto_advance: number | null;
  current_turn_index: number | null;
  total_cost_usd: number | null;
}

function rowToSession(row: SessionRow): Session {
  return Session.reconstitute({
    id: row.id,
    agentType: v.parse(AgentTypeSchema, row.agent_type),
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
    sessionType: row.session_type ?? 'interactive',
    autoAdvance: row.auto_advance === 1,
    currentTurnIndex: row.current_turn_index ?? 0,
    totalCostUsd: row.total_cost_usd ?? 0,
  });
}

function createSqliteSessionRepository(db: Database): SessionStoreShape {
  const upsertStmt = db.prepare(`
    INSERT INTO sessions (id, agent_type, mode, cwd, git_branch, git_remote_url, repo_name, started_at, ended_at, status, exit_code, agent_session_id, resumable, session_type, auto_advance, current_turn_index, total_cost_usd)
    VALUES ($id, $agent_type, $mode, $cwd, $git_branch, $git_remote_url, $repo_name, $started_at, $ended_at, $status, $exit_code, $agent_session_id, $resumable, $session_type, $auto_advance, $current_turn_index, $total_cost_usd)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      ended_at = excluded.ended_at,
      exit_code = excluded.exit_code,
      agent_session_id = excluded.agent_session_id,
      resumable = excluded.resumable,
      session_type = excluded.session_type,
      auto_advance = excluded.auto_advance,
      current_turn_index = excluded.current_turn_index,
      total_cost_usd = excluded.total_cost_usd
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
          "SELECT id, agent_session_id, cwd, resumable, agent_type FROM sessions WHERE status = 'active' AND agent_session_id IS NOT NULL"
        )
        .all() as Array<{
        id: string;
        agent_session_id: string;
        cwd: string;
        resumable: number;
        agent_type: string;
      }>;
      return rows.map((r) => ({
        id: makeSessionId(r.id),
        agentSessionId: r.agent_session_id,
        cwd: r.cwd,
        resumable: r.resumable === 1,
        agentType: r.agent_type as AgentType,
      }));
    },

    findRecentlyEnded(withinMs: number): ResumableSessionInfo[] {
      const cutoff = Date.now() - withinMs;
      const rows = db
        .prepare(
          "SELECT id, agent_session_id, cwd, resumable, agent_type FROM sessions WHERE status = 'ended' AND agent_session_id IS NOT NULL AND ended_at > $cutoff AND resumable = 0"
        )
        .all({ $cutoff: cutoff }) as Array<{
        id: string;
        agent_session_id: string;
        cwd: string;
        resumable: number;
        agent_type: string;
      }>;
      return rows.map((r) => ({
        id: makeSessionId(r.id),
        agentSessionId: r.agent_session_id,
        cwd: r.cwd,
        resumable: r.resumable === 1,
        agentType: r.agent_type as AgentType,
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
        $session_type: session.sessionType,
        $auto_advance: session.autoAdvance ? 1 : 0,
        $current_turn_index: session.currentTurnIndex,
        $total_cost_usd: session.totalCostUsd,
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

export const SqliteSessionRepositoryLive = Layer.effect(SessionStore)(
  Effect.gen(function* () {
    const { sqlite } = yield* VigiDatabase;
    return createSqliteSessionRepository(sqlite);
  })
);
