import type { Database } from 'bun:sqlite';
import { Effect, Layer } from 'effect';
import {
  StructuredEventStore,
  type StructuredEventStoreShape,
  type Turn,
} from '#modules/agent-session/application/ports/out/structured-event-store.port';
import { VigiDatabase } from '#shared/db/database';
import type {
  CostUpdate,
  SubagentSpawn,
  TextDelta,
  ToolCall,
  TurnCompleted,
  TurnStarted,
} from '#shared/kernel/session/events';
import { SessionId } from '#shared/kernel/session/session-id';

interface TurnRow {
  id: string;
  session_id: string;
  turn_index: number;
  prompt: string;
  mode: string;
  stop_reason: string | null;
  summary: string | null;
  started_at: string;
  completed_at: string | null;
}

interface ToolCallRow {
  id: string;
  session_id: string;
  turn_index: number;
  tool_name: string;
  input: string;
  status: string;
  output: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

interface TextDeltaRow {
  id: string;
  session_id: string;
  turn_index: number;
  role: string;
  content: string;
  created_at: string;
}

interface CostUpdateRow {
  id: string;
  session_id: string;
  turn_index: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  total_cost_usd: number;
  model_id: string;
  created_at: string;
}

interface SubagentSpawnRow {
  id: string;
  session_id: string;
  turn_index: number;
  parent_tool_call_id: string;
  subagent_session_id: string;
  description: string;
  created_at: string;
}

interface CostSumRow {
  total: number | null;
}

function rowToTurn(row: TurnRow): Turn {
  return {
    id: row.id,
    sessionId: row.session_id,
    turnIndex: row.turn_index,
    prompt: row.prompt,
    mode: row.mode,
    stopReason: row.stop_reason,
    summary: row.summary,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function rowToToolCall(row: ToolCallRow): ToolCall {
  return {
    type: 'agent:tool-call',
    sessionId: SessionId(row.session_id),
    turnIndex: row.turn_index,
    toolName: row.tool_name,
    toolCallId: row.id,
    input: JSON.parse(row.input) as Record<string, unknown>,
    status: row.status as ToolCall['status'],
    output: row.output ?? undefined,
    error: row.error ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    timestamp: new Date(row.created_at).getTime(),
  };
}

function rowToTextDelta(row: TextDeltaRow): TextDelta {
  return {
    type: 'agent:text-delta',
    sessionId: SessionId(row.session_id),
    turnIndex: row.turn_index,
    role: row.role as TextDelta['role'],
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
  };
}

function rowToCostUpdate(row: CostUpdateRow): CostUpdate {
  return {
    type: 'agent:cost-update',
    sessionId: SessionId(row.session_id),
    turnIndex: row.turn_index,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens ?? undefined,
    cacheWriteTokens: row.cache_write_tokens ?? undefined,
    totalCostUsd: row.total_cost_usd,
    modelId: row.model_id,
    timestamp: new Date(row.created_at).getTime(),
  };
}

function rowToSubagentSpawn(row: SubagentSpawnRow): SubagentSpawn {
  return {
    type: 'agent:subagent-spawn',
    sessionId: SessionId(row.session_id),
    turnIndex: row.turn_index,
    parentToolCallId: row.parent_tool_call_id,
    subagentSessionId: row.subagent_session_id,
    description: row.description,
    timestamp: new Date(row.created_at).getTime(),
  };
}

export function createSqliteStructuredEventRepository(db: Database): StructuredEventStoreShape {
  const insertTurnStmt = db.prepare(`
    INSERT INTO turns (id, session_id, turn_index, prompt, mode, started_at)
    VALUES ($id, $session_id, $turn_index, $prompt, $mode, $started_at)
  `);

  const completeTurnStmt = db.prepare(`
    UPDATE turns
    SET stop_reason = $stop_reason, summary = $summary, completed_at = $completed_at
    WHERE session_id = $session_id AND turn_index = $turn_index
  `);

  const insertTextDeltaStmt = db.prepare(`
    INSERT INTO text_deltas (id, session_id, turn_index, role, content, created_at)
    VALUES ($id, $session_id, $turn_index, $role, $content, $created_at)
  `);

  const insertToolCallStmt = db.prepare(`
    INSERT INTO tool_calls (id, session_id, turn_index, tool_name, input, status, created_at, updated_at)
    VALUES ($id, $session_id, $turn_index, $tool_name, $input, $status, $created_at, $updated_at)
  `);

  const updateToolCallStmt = db.prepare(`
    UPDATE tool_calls
    SET status = $status, output = $output, error = $error, duration_ms = $duration_ms, updated_at = $updated_at
    WHERE id = $id
  `);

  const insertCostUpdateStmt = db.prepare(`
    INSERT INTO cost_updates (id, session_id, turn_index, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, model_id, created_at)
    VALUES ($id, $session_id, $turn_index, $input_tokens, $output_tokens, $cache_read_tokens, $cache_write_tokens, $total_cost_usd, $model_id, $created_at)
  `);

  const insertSubagentSpawnStmt = db.prepare(`
    INSERT INTO subagent_spawns (id, session_id, turn_index, parent_tool_call_id, subagent_session_id, description, created_at)
    VALUES ($id, $session_id, $turn_index, $parent_tool_call_id, $subagent_session_id, $description, $created_at)
  `);

  const getTurnsStmt = db.prepare(
    'SELECT * FROM turns WHERE session_id = $session_id ORDER BY turn_index ASC'
  );

  const getToolCallsStmt = db.prepare(
    'SELECT * FROM tool_calls WHERE session_id = $session_id ORDER BY turn_index ASC, created_at ASC'
  );

  const getToolCallsByTurnStmt = db.prepare(
    'SELECT * FROM tool_calls WHERE session_id = $session_id AND turn_index = $turn_index ORDER BY created_at ASC'
  );

  const getCostUpdatesStmt = db.prepare(
    'SELECT * FROM cost_updates WHERE session_id = $session_id ORDER BY created_at ASC'
  );

  const getTextDeltasStmt = db.prepare(
    'SELECT * FROM text_deltas WHERE session_id = $session_id AND turn_index = $turn_index ORDER BY created_at ASC'
  );

  const getSubagentSpawnsStmt = db.prepare(
    'SELECT * FROM subagent_spawns WHERE session_id = $session_id ORDER BY created_at ASC'
  );

  const getSessionTotalCostStmt = db.prepare(
    'SELECT SUM(total_cost_usd) AS total FROM cost_updates WHERE session_id = $session_id'
  );

  return {
    insertTurn(event: TurnStarted): void {
      const now = new Date(event.timestamp).toISOString();
      insertTurnStmt.run({
        $id: crypto.randomUUID(),
        $session_id: event.sessionId,
        $turn_index: event.turnIndex,
        $prompt: event.prompt,
        $mode: event.mode,
        $started_at: now,
      });
    },

    completeTurn(event: TurnCompleted): void {
      const now = new Date(event.timestamp).toISOString();
      completeTurnStmt.run({
        $stop_reason: event.stopReason,
        $summary: event.summary ?? null,
        $completed_at: now,
        $session_id: event.sessionId,
        $turn_index: event.turnIndex,
      });
    },

    insertTextDelta(event: TextDelta): void {
      const now = new Date(event.timestamp).toISOString();
      insertTextDeltaStmt.run({
        $id: crypto.randomUUID(),
        $session_id: event.sessionId,
        $turn_index: event.turnIndex,
        $role: event.role,
        $content: event.content,
        $created_at: now,
      });
    },

    insertToolCall(event: ToolCall): void {
      const now = new Date(event.timestamp).toISOString();
      insertToolCallStmt.run({
        $id: event.toolCallId,
        $session_id: event.sessionId,
        $turn_index: event.turnIndex,
        $tool_name: event.toolName,
        $input: JSON.stringify(event.input),
        $status: event.status,
        $created_at: now,
        $updated_at: now,
      });
    },

    updateToolCall(event: ToolCall): void {
      const now = new Date(event.timestamp).toISOString();
      updateToolCallStmt.run({
        $status: event.status,
        $output: event.output ?? null,
        $error: event.error ?? null,
        $duration_ms: event.durationMs ?? null,
        $updated_at: now,
        $id: event.toolCallId,
      });
    },

    insertCostUpdate(event: CostUpdate): void {
      const now = new Date(event.timestamp).toISOString();
      insertCostUpdateStmt.run({
        $id: crypto.randomUUID(),
        $session_id: event.sessionId,
        $turn_index: event.turnIndex,
        $input_tokens: event.inputTokens,
        $output_tokens: event.outputTokens,
        $cache_read_tokens: event.cacheReadTokens ?? null,
        $cache_write_tokens: event.cacheWriteTokens ?? null,
        $total_cost_usd: event.totalCostUsd,
        $model_id: event.modelId,
        $created_at: now,
      });
    },

    insertSubagentSpawn(event: SubagentSpawn): void {
      const now = new Date(event.timestamp).toISOString();
      insertSubagentSpawnStmt.run({
        $id: crypto.randomUUID(),
        $session_id: event.sessionId,
        $turn_index: event.turnIndex,
        $parent_tool_call_id: event.parentToolCallId,
        $subagent_session_id: event.subagentSessionId,
        $description: event.description,
        $created_at: now,
      });
    },

    getTurns(sessionId: SessionId): Turn[] {
      return (getTurnsStmt.all({ $session_id: sessionId }) as TurnRow[]).map(rowToTurn);
    },

    getToolCalls(sessionId: SessionId, turnIndex?: number): ToolCall[] {
      if (turnIndex !== undefined) {
        return (
          getToolCallsByTurnStmt.all({
            $session_id: sessionId,
            $turn_index: turnIndex,
          }) as ToolCallRow[]
        ).map(rowToToolCall);
      }
      return (getToolCallsStmt.all({ $session_id: sessionId }) as ToolCallRow[]).map(rowToToolCall);
    },

    getCostUpdates(sessionId: SessionId): CostUpdate[] {
      return (getCostUpdatesStmt.all({ $session_id: sessionId }) as CostUpdateRow[]).map(
        rowToCostUpdate
      );
    },

    getTextDeltas(sessionId: SessionId, turnIndex: number): TextDelta[] {
      return (
        getTextDeltasStmt.all({
          $session_id: sessionId,
          $turn_index: turnIndex,
        }) as TextDeltaRow[]
      ).map(rowToTextDelta);
    },

    getSubagentSpawns(sessionId: SessionId): SubagentSpawn[] {
      return (getSubagentSpawnsStmt.all({ $session_id: sessionId }) as SubagentSpawnRow[]).map(
        rowToSubagentSpawn
      );
    },

    getSessionTotalCost(sessionId: SessionId): number {
      const row = getSessionTotalCostStmt.get({ $session_id: sessionId }) as CostSumRow | null;
      return row?.total ?? 0;
    },
  };
}

export const SqliteStructuredEventRepositoryLive = Layer.effect(StructuredEventStore)(
  Effect.gen(function* () {
    const { sqlite } = yield* VigiDatabase;
    return createSqliteStructuredEventRepository(sqlite);
  })
);
