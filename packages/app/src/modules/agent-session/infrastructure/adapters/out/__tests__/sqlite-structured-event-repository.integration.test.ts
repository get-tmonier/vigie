import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { Kysely } from 'kysely';
import { createBunSqliteDialect } from '#shared/db/dialect';
import '#shared/db/migrations/001-initial-schema';
import { runMigrations } from '#shared/db/migrator';
import type { VigiDatabaseSchema } from '#shared/db/schema';
import { SessionId } from '#shared/kernel/session/session-id';
import { createSqliteStructuredEventRepository } from '../sqlite-structured-event-repository';

function setup() {
  const sqlite = new Database(':memory:');
  const kysely = new Kysely<VigiDatabaseSchema>({ dialect: createBunSqliteDialect(sqlite) });
  runMigrations(kysely, sqlite);

  // Insert a session to satisfy FK
  sqlite.run(
    "INSERT INTO sessions (id, agent_type, cwd, started_at, status) VALUES ('sess-1', 'claude', '/tmp', 1000, 'active')"
  );

  return createSqliteStructuredEventRepository(sqlite);
}

describe('SqliteStructuredEventRepository', () => {
  it('inserts and retrieves a turn', () => {
    const repo = setup();
    const sessionId = SessionId('sess-1');

    repo.insertTurn({
      type: 'agent:turn-started',
      sessionId,
      turnIndex: 0,
      prompt: 'Fix the bug',
      mode: 'manual',
      timestamp: Date.now(),
    });

    const turns = repo.getTurns(sessionId);
    expect(turns).toHaveLength(1);
    expect(turns[0].prompt).toBe('Fix the bug');
    expect(turns[0].turnIndex).toBe(0);
  });

  it('completes a turn', () => {
    const repo = setup();
    const sessionId = SessionId('sess-1');

    repo.insertTurn({
      type: 'agent:turn-started',
      sessionId,
      turnIndex: 0,
      prompt: 'hello',
      mode: 'manual',
      timestamp: Date.now(),
    });

    repo.completeTurn({
      type: 'agent:turn-completed',
      sessionId,
      turnIndex: 0,
      stopReason: 'end_turn',
      summary: 'Done',
      timestamp: Date.now(),
    });

    const turns = repo.getTurns(sessionId);
    expect(turns[0].stopReason).toBe('end_turn');
    expect(turns[0].summary).toBe('Done');
    expect(turns[0].completedAt).toBeDefined();
  });

  it('inserts and retrieves tool calls', () => {
    const repo = setup();
    const sessionId = SessionId('sess-1');

    repo.insertToolCall({
      type: 'agent:tool-call',
      sessionId,
      turnIndex: 0,
      toolName: 'Read',
      toolCallId: 'tc-1',
      input: { file_path: '/foo.ts' },
      status: 'running',
      timestamp: Date.now(),
    });

    repo.updateToolCall({
      type: 'agent:tool-call',
      sessionId,
      turnIndex: 0,
      toolName: 'Read',
      toolCallId: 'tc-1',
      input: { file_path: '/foo.ts' },
      status: 'completed',
      output: 'file contents here',
      durationMs: 42,
      timestamp: Date.now(),
    });

    const calls = repo.getToolCalls(sessionId, 0);
    expect(calls).toHaveLength(1);
    expect(calls[0].status).toBe('completed');
    expect(calls[0].output).toBe('file contents here');
  });

  it('inserts text deltas', () => {
    const repo = setup();
    const sessionId = SessionId('sess-1');

    repo.insertTextDelta({
      type: 'agent:text-delta',
      sessionId,
      turnIndex: 0,
      role: 'assistant',
      content: 'Hello world',
      timestamp: Date.now(),
    });

    const deltas = repo.getTextDeltas(sessionId, 0);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].content).toBe('Hello world');
    expect(deltas[0].role).toBe('assistant');
  });

  it('calculates session total cost', () => {
    const repo = setup();
    const sessionId = SessionId('sess-1');

    repo.insertCostUpdate({
      type: 'agent:cost-update',
      sessionId,
      turnIndex: 0,
      inputTokens: 1000,
      outputTokens: 500,
      totalCostUsd: 0.03,
      modelId: 'claude-sonnet-4-6',
      timestamp: Date.now(),
    });

    repo.insertCostUpdate({
      type: 'agent:cost-update',
      sessionId,
      turnIndex: 1,
      inputTokens: 2000,
      outputTokens: 800,
      totalCostUsd: 0.05,
      modelId: 'claude-sonnet-4-6',
      timestamp: Date.now(),
    });

    const total = repo.getSessionTotalCost(sessionId);
    expect(total).toBeCloseTo(0.08);
  });

  it('inserts subagent spawns', () => {
    const repo = setup();
    const sessionId = SessionId('sess-1');

    // Need a tool call first for FK
    repo.insertToolCall({
      type: 'agent:tool-call',
      sessionId,
      turnIndex: 0,
      toolName: 'Agent',
      toolCallId: 'tc-parent',
      input: {},
      status: 'running',
      timestamp: Date.now(),
    });

    repo.insertSubagentSpawn({
      type: 'agent:subagent-spawn',
      sessionId,
      turnIndex: 0,
      parentToolCallId: 'tc-parent',
      subagentSessionId: 'sub-1',
      description: 'Research task',
      timestamp: Date.now(),
    });

    const spawns = repo.getSubagentSpawns(sessionId);
    expect(spawns).toHaveLength(1);
    expect(spawns[0].description).toBe('Research task');
  });
});
