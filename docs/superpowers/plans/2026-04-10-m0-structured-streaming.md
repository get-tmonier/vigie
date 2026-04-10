# M0 Structured Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured event layer so vigie's browser dashboard shows rich data (tool calls, costs, messages) instead of raw terminal output, while preserving xterm.js for interactive sessions.

**Architecture:** Foundation + Feature Tracks. Phase 1 builds Kysely migration infrastructure and the expanded domain model. Phase 2 adds the Claude SDK adapter (structured channel). Phase 3 adds the hook receiver (interactive channel). Phase 4 redesigns the dashboard UI.

**Tech Stack:** Bun, Effect, Valibot, Kysely (bun:sqlite dialect), @anthropic-ai/claude-agent-sdk, React SSR + Vite islands, nanostores, Tailwind

**Spec:** `docs/superpowers/specs/2026-04-10-m0-structured-streaming-design.md`

---

## Phase 1: Foundation

### Task 1: Install Kysely and Create Migration Infrastructure

**Files:**
- Modify: `packages/app/package.json`
- Create: `packages/app/src/shared/db/migrator.ts`
- Create: `packages/app/src/shared/db/migrations/001-initial-schema.ts`
- Test: `packages/app/src/shared/db/__tests__/migrator.integration.test.ts`

- [ ] **Step 1: Install kysely**

```bash
cd packages/app && bun add kysely@0.27.6
```

Pin to exact version per project rules.

- [ ] **Step 2: Write failing test for migration infrastructure**

Create `packages/app/src/shared/db/__tests__/migrator.integration.test.ts`:

```typescript
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { Kysely } from 'kysely';
import { createBunSqliteDialect } from '../dialect';
import { runMigrations } from '../migrator';

describe('migrator', () => {
  it('creates migration tracking table and applies migrations', () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely({ dialect: createBunSqliteDialect(sqlite) });

    runMigrations(db, sqlite);

    // Check that the sessions table exists (from migration 001)
    const tables = sqlite
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);

    expect(tables).toContain('sessions');
    expect(tables).toContain('terminal_chunks');
    expect(tables).toContain('input_history');
    expect(tables).toContain('_migrations');
  });

  it('is idempotent — running twice does not error', () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely({ dialect: createBunSqliteDialect(sqlite) });

    runMigrations(db, sqlite);
    runMigrations(db, sqlite); // second run

    const count = sqlite.query<{ cnt: number }, []>('SELECT count(*) as cnt FROM _migrations').get();
    expect(count!.cnt).toBe(1); // still one migration applied
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/app && bun test src/shared/db/__tests__/migrator.integration.test.ts
```

Expected: FAIL — modules `../dialect` and `../migrator` don't exist.

- [ ] **Step 4: Create Bun SQLite dialect adapter for Kysely**

Create `packages/app/src/shared/db/dialect.ts`:

```typescript
import type { Database } from 'bun:sqlite';
import {
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type Kysely,
  type CompiledQuery,
} from 'kysely';

class BunSqliteConnection implements DatabaseConnection {
  constructor(private db: Database) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const stmt = this.db.prepare(sql);
    if (sql.trimStart().toUpperCase().startsWith('SELECT') || sql.includes('RETURNING')) {
      const rows = stmt.all(...(parameters as unknown[])) as R[];
      return { rows };
    }
    const result = stmt.run(...(parameters as unknown[]));
    return {
      rows: [],
      numAffectedRows: BigInt(result.changes),
      insertId: result.lastInsertRowid !== undefined ? BigInt(result.lastInsertRowid) : undefined,
    };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Streaming not supported with bun:sqlite');
  }
}

class BunSqliteDriver implements Driver {
  constructor(private db: Database) {}
  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new BunSqliteConnection(this.db);
  }
  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({ sql: 'BEGIN', parameters: [], query: { kind: 'RawNode', sqlFragments: ['BEGIN'], parameters: [] } } as CompiledQuery);
  }
  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({ sql: 'COMMIT', parameters: [], query: { kind: 'RawNode', sqlFragments: ['COMMIT'], parameters: [] } } as CompiledQuery);
  }
  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({ sql: 'ROLLBACK', parameters: [], query: { kind: 'RawNode', sqlFragments: ['ROLLBACK'], parameters: [] } } as CompiledQuery);
  }
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

export function createBunSqliteDialect(db: Database): Dialect {
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new BunSqliteDriver(db),
    createIntrospector: (kysely: Kysely<unknown>) => new SqliteIntrospector(kysely),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  };
}
```

- [ ] **Step 5: Create migration runner**

Create `packages/app/src/shared/db/migrator.ts`:

```typescript
import type { Database } from 'bun:sqlite';
import type { Kysely } from 'kysely';
import type { VigiDatabaseSchema } from './schema';

export interface Migration {
  readonly name: string;
  up(db: Database): void;
}

const migrations: Migration[] = [];

export function registerMigration(migration: Migration): void {
  migrations.push(migration);
}

export function runMigrations(kysely: Kysely<VigiDatabaseSchema>, db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.query<{ name: string }, []>('SELECT name FROM _migrations').all().map((r) => r.name)
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    migration.up(db);
    db.run('INSERT INTO _migrations (name) VALUES (?)', [migration.name]);
  }
}
```

- [ ] **Step 6: Create database schema types**

Create `packages/app/src/shared/db/schema.ts`:

```typescript
export interface SessionsTable {
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
  session_type: string;
  auto_advance: number;
  current_turn_index: number;
  total_cost_usd: number;
}

export interface TerminalChunksTable {
  id: number;
  session_id: string;
  data: string;
  timestamp: number;
  seq: number;
}

export interface InputHistoryTable {
  id: number;
  session_id: string;
  text: string;
  source: string;
  timestamp: number;
}

export interface TurnsTable {
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

export interface TextDeltasTable {
  id: string;
  session_id: string;
  turn_index: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ToolCallsTable {
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

export interface CostUpdatesTable {
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

export interface SubagentSpawnsTable {
  id: string;
  session_id: string;
  turn_index: number;
  parent_tool_call_id: string;
  subagent_session_id: string;
  description: string;
  created_at: string;
}

export interface MigrationsTable {
  name: string;
  applied_at: string;
}

export interface VigiDatabaseSchema {
  sessions: SessionsTable;
  terminal_chunks: TerminalChunksTable;
  input_history: InputHistoryTable;
  turns: TurnsTable;
  text_deltas: TextDeltasTable;
  tool_calls: ToolCallsTable;
  cost_updates: CostUpdatesTable;
  subagent_spawns: SubagentSpawnsTable;
  _migrations: MigrationsTable;
}
```

- [ ] **Step 7: Create initial migration (existing schema)**

Create `packages/app/src/shared/db/migrations/001-initial-schema.ts`:

```typescript
import type { Database } from 'bun:sqlite';
import { registerMigration } from '../migrator';

registerMigration({
  name: '001-initial-schema',
  up(db: Database) {
    db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_terminal_session_seq ON terminal_chunks(session_id, seq);

      CREATE TABLE IF NOT EXISTS input_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        text TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'cli',
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_input_history_session ON input_history(session_id, timestamp);

      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        mode TEXT NOT NULL,
        stop_reason TEXT,
        summary TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, turn_index);

      CREATE TABLE IF NOT EXISTS text_deltas (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_text_deltas_session_turn ON text_deltas(session_id, turn_index);

      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        input TEXT NOT NULL,
        status TEXT NOT NULL,
        output TEXT,
        error TEXT,
        duration_ms INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tool_calls_session_turn ON tool_calls(session_id, turn_index);

      CREATE TABLE IF NOT EXISTS cost_updates (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cache_read_tokens INTEGER,
        cache_write_tokens INTEGER,
        total_cost_usd REAL NOT NULL,
        model_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cost_updates_session ON cost_updates(session_id);

      CREATE TABLE IF NOT EXISTS subagent_spawns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        parent_tool_call_id TEXT NOT NULL REFERENCES tool_calls(id),
        subagent_session_id TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subagent_spawns_session ON subagent_spawns(session_id);
    `);
  },
});
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd packages/app && bun test src/shared/db/__tests__/migrator.integration.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/app/package.json packages/app/src/shared/db/
git commit -m "feat(db): add Kysely migration infrastructure with initial schema"
```

---

### Task 2: Migrate Database Layer from Raw SQLite to Kysely

**Files:**
- Modify: `packages/app/src/shared/db/database.ts`
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts`
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts`
- Modify: `packages/app/src/modules/agent-session/dependencies.ts`
- Modify: `packages/app/src/dependencies.ts`

- [ ] **Step 1: Write failing test — verify Kysely is accessible from database layer**

Add to `packages/app/src/shared/db/__tests__/migrator.integration.test.ts`:

```typescript
import { VigiDatabase, type VigiKysely } from '../database';

describe('database layer', () => {
  it('provides both raw sqlite and typed kysely instance', () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely<VigiDatabaseSchema>({ dialect: createBunSqliteDialect(sqlite) });
    runMigrations(db, sqlite);

    // Verify we can query through Kysely
    const sessions = db.selectFrom('sessions').selectAll().execute();
    expect(sessions).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/app && bun test src/shared/db/__tests__/migrator.integration.test.ts
```

Expected: FAIL — `VigiKysely` not exported from database.ts yet.

- [ ] **Step 3: Rewrite database.ts to use Kysely + migrations**

Replace `packages/app/src/shared/db/database.ts`:

```typescript
import { Database } from 'bun:sqlite';
import { Kysely } from 'kysely';
import { Layer, ServiceMap } from 'effect';
import { createBunSqliteDialect } from './dialect';
import { runMigrations } from './migrator';
import type { VigiDatabaseSchema } from './schema';

// Import migrations to register them
import './migrations/001-initial-schema';

export type VigiKysely = Kysely<VigiDatabaseSchema>;

export interface VigiDatabaseServices {
  readonly sqlite: Database;
  readonly kysely: VigiKysely;
}

export class VigiDatabase extends ServiceMap.Service<VigiDatabase, VigiDatabaseServices>()(
  '@vigie/Database'
) {}

function openDatabase(path: string): VigiDatabaseServices {
  const sqlite = new Database(path);
  sqlite.run('PRAGMA journal_mode = WAL');
  sqlite.run('PRAGMA synchronous = NORMAL');

  const kysely = new Kysely<VigiDatabaseSchema>({
    dialect: createBunSqliteDialect(sqlite),
  });

  runMigrations(kysely, sqlite);

  return { sqlite, kysely };
}

export const makeDatabaseLayer = (dbFile: string) =>
  Layer.sync(VigiDatabase)(() => openDatabase(dbFile));
```

- [ ] **Step 4: Update sqlite-session-repository.ts to use Kysely's typed database**

The repository currently uses raw `Database` from `bun:sqlite` with prepared statements. Update it to accept `VigiDatabaseServices` and use `services.sqlite` for the raw prepared statements (keeping the existing query pattern for now — full Kysely query migration is a later optimization). The key change is the constructor receives `{ sqlite, kysely }` instead of just `Database`.

Update the layer creation at the bottom:

```typescript
export const SqliteSessionRepositoryLive = Layer.effect(SessionStore)(
  Effect.gen(function* () {
    const { sqlite } = yield* VigiDatabase;
    return createSqliteSessionRepository(sqlite);
  })
);
```

Also update the `save()` method to persist the new session fields:
- `session_type` (from `session.sessionType ?? 'interactive'`)
- `auto_advance` (from `session.autoAdvance ? 1 : 0`)
- `current_turn_index` (from `session.currentTurnIndex ?? 0`)
- `total_cost_usd` (from `session.totalCostUsd ?? 0`)

And update `reconstitute` mapping to read those columns back.

- [ ] **Step 5: Update sqlite-terminal-repository.ts similarly**

Change the layer to yield `{ sqlite }` from `VigiDatabase` instead of the raw `Database`.

- [ ] **Step 6: Run existing tests**

```bash
cd packages/app && bun test
```

Expected: All existing tests PASS. The repository tests should still work because the raw SQLite interface is preserved.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/shared/db/ packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts
git commit -m "refactor(db): migrate database layer to Kysely with typed schema"
```

---

### Task 3: Expand Session Status Model

**Files:**
- Modify: `packages/app/src/modules/agent-session/domain/session-status.ts`
- Modify: `packages/app/src/modules/agent-session/domain/session.ts`
- Modify: `packages/app/src/modules/agent-session/domain/errors.ts`
- Test: `packages/app/src/modules/agent-session/domain/__tests__/session-status.unit.test.ts`
- Test: `packages/app/src/modules/agent-session/domain/__tests__/session.unit.test.ts`

- [ ] **Step 1: Write failing tests for new status transitions**

Add to `packages/app/src/modules/agent-session/domain/__tests__/session-status.unit.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { canTransition } from '#modules/agent-session/domain/session-status';

describe('extended status transitions', () => {
  it('active → paused is valid', () => {
    expect(canTransition('active', 'paused')).toBe(true);
  });

  it('paused → active is valid (resume)', () => {
    expect(canTransition('paused', 'active')).toBe(true);
  });

  it('active → abandoned is valid', () => {
    expect(canTransition('active', 'abandoned')).toBe(true);
  });

  it('active → killed is valid', () => {
    expect(canTransition('active', 'killed')).toBe(true);
  });

  it('ended → archived is valid', () => {
    expect(canTransition('ended', 'archived')).toBe(true);
  });

  it('abandoned → archived is valid', () => {
    expect(canTransition('abandoned', 'archived')).toBe(true);
  });

  it('killed → archived is valid', () => {
    expect(canTransition('killed', 'archived')).toBe(true);
  });

  it('error → archived is valid', () => {
    expect(canTransition('error', 'archived')).toBe(true);
  });

  it('archived → active is not valid', () => {
    expect(canTransition('archived', 'active')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/app && bun test src/modules/agent-session/domain/__tests__/session-status.unit.test.ts
```

Expected: FAIL — new statuses not defined.

- [ ] **Step 3: Expand session-status.ts**

```typescript
export type SessionStatus =
  | 'registering'
  | 'active'
  | 'paused'
  | 'ended'
  | 'error'
  | 'abandoned'
  | 'killed'
  | 'archived';

const VALID_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  registering: ['active', 'ended', 'error'],
  active: ['paused', 'ended', 'error', 'abandoned', 'killed'],
  paused: ['active', 'ended', 'error', 'abandoned', 'killed'],
  ended: ['active', 'archived'], // active = resume
  error: ['archived'],
  abandoned: ['archived'],
  killed: ['archived'],
  archived: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

- [ ] **Step 4: Add Session aggregate methods for new statuses**

Add to `Session` class in `session.ts`:

```typescript
markPaused(): void {
  this.transitionTo('paused');
  this._events.push({
    type: 'session:ended', // reuse ended event with a paused signal
    sessionId: this.id,
    exitCode: 0,
    resumable: true,
    timestamp: Date.now(),
  });
}

markAbandoned(): void {
  this.transitionTo('abandoned');
  this._endedAt = Date.now();
  this._events.push({
    type: 'session:ended',
    sessionId: this.id,
    exitCode: -2,
    resumable: false,
    timestamp: this._endedAt,
  });
}

markKilled(): void {
  this.transitionTo('killed');
  this._endedAt = Date.now();
  this._events.push({
    type: 'session:ended',
    sessionId: this.id,
    exitCode: -3,
    resumable: false,
    timestamp: this._endedAt,
  });
}

reactivate(): void {
  this.transitionTo('active');
}

archive(): void {
  if (this.isActive || this.status === 'paused') {
    throw new CannotDeleteActiveSessionError({ sessionId: this.id });
  }
  this.transitionTo('archived');
}
```

Also update the `canDelete` getter:

```typescript
get canDelete(): boolean {
  return this._status !== 'active' && this._status !== 'paused';
}
```

- [ ] **Step 5: Write Session tests for new methods**

Add to `session.unit.test.ts`:

```typescript
describe('Session.markPaused', () => {
  it('transitions active → paused', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.markPaused();
    expect(session.status).toBe('paused');
  });
});

describe('Session.markAbandoned', () => {
  it('transitions active → abandoned', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.markAbandoned();
    expect(session.status).toBe('abandoned');
    expect(session.endedAt).toBeDefined();
  });
});

describe('Session.markKilled', () => {
  it('transitions active → killed', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.markKilled();
    expect(session.status).toBe('killed');
  });
});

describe('Session.reactivate', () => {
  it('transitions paused → active', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.markPaused();
    session.reactivate();
    expect(session.status).toBe('active');
  });
});

describe('Session.archive', () => {
  it('transitions ended → archived', () => {
    const session = makeActiveSession();
    session.markEnded(0, false);
    session.pullEvents();
    session.archive();
    expect(session.status).toBe('archived');
  });

  it('throws from active status', () => {
    const session = makeActiveSession();
    expect(() => session.archive()).toThrow(CannotDeleteActiveSessionError);
  });
});
```

- [ ] **Step 6: Run all domain tests**

```bash
cd packages/app && bun test src/modules/agent-session/domain/
```

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/modules/agent-session/domain/
git commit -m "feat(domain): expand session status model with paused, abandoned, killed, archived"
```

---

### Task 4: Add Structured Event Types

**Files:**
- Modify: `packages/app/src/shared/kernel/session/events.ts`
- Test: `packages/app/src/shared/kernel/session/__tests__/events.unit.test.ts`

- [ ] **Step 1: Write failing tests for new event schemas**

Add to `packages/app/src/shared/kernel/session/__tests__/events.unit.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  TextDeltaSchema,
  ToolCallSchema,
  CostUpdateSchema,
  SubagentSpawnSchema,
  TurnStartedSchema,
  TurnCompletedSchema,
  StructuredEventSchema,
  SessionEventSchema,
} from '#shared/kernel/session/events';
import { SessionId } from '#shared/kernel/session/session-id';

describe('StructuredEvent schemas', () => {
  const sessionId = SessionId('test-sess');

  it('validates TextDelta', () => {
    const result = v.safeParse(TextDeltaSchema, {
      type: 'agent:text-delta',
      sessionId,
      turnIndex: 0,
      role: 'assistant',
      content: 'Hello',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates ToolCall', () => {
    const result = v.safeParse(ToolCallSchema, {
      type: 'agent:tool-call',
      sessionId,
      turnIndex: 1,
      toolName: 'Read',
      toolCallId: 'tc-1',
      input: { file_path: '/foo' },
      status: 'running',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates CostUpdate', () => {
    const result = v.safeParse(CostUpdateSchema, {
      type: 'agent:cost-update',
      sessionId,
      turnIndex: 0,
      inputTokens: 1000,
      outputTokens: 500,
      totalCostUsd: 0.03,
      modelId: 'claude-sonnet-4-6',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates TurnCompleted', () => {
    const result = v.safeParse(TurnCompletedSchema, {
      type: 'agent:turn-completed',
      sessionId,
      turnIndex: 0,
      stopReason: 'end_turn',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('SessionEventSchema accepts both lifecycle and structured events', () => {
    const lifecycle = v.safeParse(SessionEventSchema, {
      type: 'session:started',
      sessionId,
      agentType: 'claude',
      mode: 'prompt',
      cwd: '/tmp',
      timestamp: Date.now(),
    });
    const structured = v.safeParse(SessionEventSchema, {
      type: 'agent:text-delta',
      sessionId,
      turnIndex: 0,
      role: 'assistant',
      content: 'Hi',
      timestamp: Date.now(),
    });
    expect(lifecycle.success).toBe(true);
    expect(structured.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/app && bun test src/shared/kernel/session/__tests__/events.unit.test.ts
```

Expected: FAIL — new schemas not exported.

- [ ] **Step 3: Add structured event schemas to events.ts**

Add to `packages/app/src/shared/kernel/session/events.ts` after the terminal event schemas:

```typescript
// --- Structured Agent Events (M0) ---

export const TextDeltaSchema = v.object({
  type: v.literal('agent:text-delta'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  role: v.picklist(['assistant', 'user']),
  content: v.string(),
  timestamp: v.number(),
});

export const ToolCallSchema = v.object({
  type: v.literal('agent:tool-call'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  toolName: v.string(),
  toolCallId: v.string(),
  input: v.record(v.string(), v.unknown()),
  status: v.picklist(['running', 'completed', 'error']),
  output: v.optional(v.string()),
  error: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  timestamp: v.number(),
});

export const CostUpdateSchema = v.object({
  type: v.literal('agent:cost-update'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.optional(v.number()),
  cacheWriteTokens: v.optional(v.number()),
  totalCostUsd: v.number(),
  modelId: v.string(),
  timestamp: v.number(),
});

export const SubagentSpawnSchema = v.object({
  type: v.literal('agent:subagent-spawn'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  parentToolCallId: v.string(),
  subagentSessionId: v.string(),
  description: v.string(),
  timestamp: v.number(),
});

export const TurnStartedSchema = v.object({
  type: v.literal('agent:turn-started'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  prompt: v.string(),
  mode: v.picklist(['auto', 'manual']),
  timestamp: v.number(),
});

export const TurnCompletedSchema = v.object({
  type: v.literal('agent:turn-completed'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  stopReason: v.picklist(['end_turn', 'max_tokens', 'pause', 'error']),
  summary: v.optional(v.string()),
  timestamp: v.number(),
});

export const StructuredEventSchema = v.variant('type', [
  TextDeltaSchema,
  ToolCallSchema,
  CostUpdateSchema,
  SubagentSpawnSchema,
  TurnStartedSchema,
  TurnCompletedSchema,
]);
export type StructuredEvent = v.InferOutput<typeof StructuredEventSchema>;
export type TextDelta = v.InferOutput<typeof TextDeltaSchema>;
export type ToolCall = v.InferOutput<typeof ToolCallSchema>;
export type CostUpdate = v.InferOutput<typeof CostUpdateSchema>;
export type SubagentSpawn = v.InferOutput<typeof SubagentSpawnSchema>;
export type TurnStarted = v.InferOutput<typeof TurnStartedSchema>;
export type TurnCompleted = v.InferOutput<typeof TurnCompletedSchema>;
```

Update the `SessionEventSchema` union to include structured events:

```typescript
export const SessionEventSchema = v.variant('type', [
  SessionStartedSchema,
  SessionEndedSchema,
  SessionErrorSchema,
  SessionDeletedSchema,
  SessionsClearedSchema,
  AgentSessionIdDetectedSchema,
  ResumableChangedSchema,
  TerminalInputEchoSchema,
  TerminalResizedSchema,
  TextDeltaSchema,
  ToolCallSchema,
  CostUpdateSchema,
  SubagentSpawnSchema,
  TurnStartedSchema,
  TurnCompletedSchema,
]);
export type SessionEvent = v.InferOutput<typeof SessionEventSchema>;
```

- [ ] **Step 4: Run tests**

```bash
cd packages/app && bun test src/shared/kernel/session/__tests__/events.unit.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/shared/kernel/session/
git commit -m "feat(domain): add structured event types — TextDelta, ToolCall, CostUpdate, SubagentSpawn, TurnStarted, TurnCompleted"
```

---

### Task 5: Evolve Session Aggregate with New Fields

**Files:**
- Modify: `packages/app/src/modules/agent-session/domain/session.ts`
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/session.dto.ts`
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/session.mapper.ts`
- Test: `packages/app/src/modules/agent-session/domain/__tests__/session.unit.test.ts`

- [ ] **Step 1: Write failing test for new session fields**

Add to `session.unit.test.ts`:

```typescript
describe('Session structured fields', () => {
  it('defaults to interactive sessionType', () => {
    const session = Session.create({ agentType: 'claude', cwd: '/tmp' });
    expect(session.sessionType).toBe('interactive');
  });

  it('can be created as structured', () => {
    const session = Session.create({
      agentType: 'claude',
      cwd: '/tmp',
      sessionType: 'structured',
    });
    expect(session.sessionType).toBe('structured');
  });

  it('defaults autoAdvance to false', () => {
    const session = Session.create({ agentType: 'claude', cwd: '/tmp' });
    expect(session.autoAdvance).toBe(false);
  });

  it('tracks currentTurnIndex', () => {
    const session = Session.create({
      agentType: 'claude',
      cwd: '/tmp',
      sessionType: 'structured',
    });
    expect(session.currentTurnIndex).toBe(0);
    session.advanceTurn();
    expect(session.currentTurnIndex).toBe(1);
  });

  it('accumulates totalCostUsd', () => {
    const session = Session.create({ agentType: 'claude', cwd: '/tmp' });
    expect(session.totalCostUsd).toBe(0);
    session.addCost(0.05);
    expect(session.totalCostUsd).toBe(0.05);
    session.addCost(0.03);
    expect(session.totalCostUsd).toBeCloseTo(0.08);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/app && bun test src/modules/agent-session/domain/__tests__/session.unit.test.ts
```

Expected: FAIL — `sessionType`, `autoAdvance`, `advanceTurn`, `addCost` not defined.

- [ ] **Step 3: Add new fields to Session aggregate**

In `session.ts`, update `CreateSessionProps`:

```typescript
interface CreateSessionProps {
  readonly id?: string;
  readonly agentType: AgentType;
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly gitRemoteUrl?: string;
  readonly repoName?: string;
  readonly mode?: 'prompt' | 'interactive';
  readonly sessionType?: 'structured' | 'interactive';
  readonly autoAdvance?: boolean;
}
```

Add private fields to Session class:

```typescript
readonly sessionType: 'structured' | 'interactive';
readonly autoAdvance: boolean;
private _currentTurnIndex: number;
private _totalCostUsd: number;
```

Initialize in constructor and static factories. Add getters and mutation methods:

```typescript
get currentTurnIndex(): number { return this._currentTurnIndex; }
get totalCostUsd(): number { return this._totalCostUsd; }

advanceTurn(): void { this._currentTurnIndex++; }
addCost(usd: number): void { this._totalCostUsd += usd; }
```

Update `ReconstitutedSessionProps` and `reconstitute()` to include new fields.

- [ ] **Step 4: Update DTO and mapper**

In `session.dto.ts`, add fields to `AgentSessionSchema`:

```typescript
sessionType: v.optional(v.picklist(['structured', 'interactive'])),
autoAdvance: v.optional(v.boolean()),
currentTurnIndex: v.optional(v.number()),
totalCostUsd: v.optional(v.number()),
```

In `session.mapper.ts`, add to `sessionToDTO`:

```typescript
sessionType: session.sessionType,
autoAdvance: session.autoAdvance,
currentTurnIndex: session.currentTurnIndex,
totalCostUsd: session.totalCostUsd,
```

- [ ] **Step 5: Run all tests**

```bash
cd packages/app && bun test
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/modules/agent-session/domain/ packages/app/src/modules/agent-session/infrastructure/adapters/in/session.dto.ts packages/app/src/modules/agent-session/infrastructure/adapters/in/session.mapper.ts
git commit -m "feat(domain): add sessionType, autoAdvance, currentTurnIndex, totalCostUsd to Session aggregate"
```

---

### Task 6: Create Structured Event Persistence Port and Repository

**Files:**
- Create: `packages/app/src/modules/agent-session/application/ports/out/structured-event-store.port.ts`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-structured-event-repository.ts`
- Test: `packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-structured-event-repository.integration.test.ts`

- [ ] **Step 1: Write the port interface**

Create `packages/app/src/modules/agent-session/application/ports/out/structured-event-store.port.ts`:

```typescript
import { ServiceMap } from 'effect';
import type { SessionId } from '#shared/kernel/session/session-id';
import type {
  CostUpdate,
  StructuredEvent,
  TextDelta,
  ToolCall,
  SubagentSpawn,
  TurnStarted,
  TurnCompleted,
} from '#shared/kernel/session/events';

export interface Turn {
  readonly id: string;
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly prompt: string;
  readonly mode: string;
  readonly stopReason: string | null;
  readonly summary: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface StructuredEventStoreShape {
  // Write
  insertTurn(event: TurnStarted): void;
  completeTurn(event: TurnCompleted): void;
  insertTextDelta(event: TextDelta): void;
  insertToolCall(event: ToolCall): void;
  updateToolCall(event: ToolCall): void;
  insertCostUpdate(event: CostUpdate): void;
  insertSubagentSpawn(event: SubagentSpawn): void;

  // Read
  getTurns(sessionId: SessionId): Turn[];
  getToolCalls(sessionId: SessionId, turnIndex?: number): ToolCall[];
  getCostUpdates(sessionId: SessionId): CostUpdate[];
  getTextDeltas(sessionId: SessionId, turnIndex: number): TextDelta[];
  getSubagentSpawns(sessionId: SessionId): SubagentSpawn[];
  getSessionTotalCost(sessionId: SessionId): number;
}

export class StructuredEventStore extends ServiceMap.Service<
  StructuredEventStore,
  StructuredEventStoreShape
>()('@vigie/StructuredEventStore') {}
```

- [ ] **Step 2: Write failing integration test**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-structured-event-repository.integration.test.ts`:

```typescript
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { Kysely } from 'kysely';
import { createBunSqliteDialect } from '#shared/db/dialect';
import { runMigrations } from '#shared/db/migrator';
import '#shared/db/migrations/001-initial-schema';
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
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-structured-event-repository.integration.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the repository**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-structured-event-repository.ts`:

```typescript
import type { Database } from 'bun:sqlite';
import { Effect, Layer } from 'effect';
import {
  StructuredEventStore,
  type StructuredEventStoreShape,
  type Turn,
} from '#modules/agent-session/application/ports/out/structured-event-store.port';
import type { SessionId } from '#shared/kernel/session/session-id';
import type {
  CostUpdate,
  SubagentSpawn,
  TextDelta,
  ToolCall,
  TurnCompleted,
  TurnStarted,
} from '#shared/kernel/session/events';
import { VigiDatabase } from '#shared/db/database';

export function createSqliteStructuredEventRepository(db: Database): StructuredEventStoreShape {
  const insertTurnStmt = db.prepare(
    'INSERT INTO turns (id, session_id, turn_index, prompt, mode, started_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const completeTurnStmt = db.prepare(
    'UPDATE turns SET stop_reason = ?, summary = ?, completed_at = ? WHERE session_id = ? AND turn_index = ?'
  );
  const insertTextDeltaStmt = db.prepare(
    'INSERT INTO text_deltas (id, session_id, turn_index, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertToolCallStmt = db.prepare(
    'INSERT INTO tool_calls (id, session_id, turn_index, tool_name, input, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const updateToolCallStmt = db.prepare(
    'UPDATE tool_calls SET status = ?, output = ?, error = ?, duration_ms = ?, updated_at = ? WHERE id = ?'
  );
  const insertCostStmt = db.prepare(
    'INSERT INTO cost_updates (id, session_id, turn_index, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertSubagentStmt = db.prepare(
    'INSERT INTO subagent_spawns (id, session_id, turn_index, parent_tool_call_id, subagent_session_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  return {
    insertTurn(event: TurnStarted): void {
      const now = new Date(event.timestamp).toISOString();
      insertTurnStmt.run(crypto.randomUUID(), event.sessionId, event.turnIndex, event.prompt, event.mode, now);
    },

    completeTurn(event: TurnCompleted): void {
      const now = new Date(event.timestamp).toISOString();
      completeTurnStmt.run(event.stopReason, event.summary ?? null, now, event.sessionId, event.turnIndex);
    },

    insertTextDelta(event: TextDelta): void {
      const now = new Date(event.timestamp).toISOString();
      insertTextDeltaStmt.run(crypto.randomUUID(), event.sessionId, event.turnIndex, event.role, event.content, now);
    },

    insertToolCall(event: ToolCall): void {
      const now = new Date(event.timestamp).toISOString();
      insertToolCallStmt.run(event.toolCallId, event.sessionId, event.turnIndex, event.toolName, JSON.stringify(event.input), event.status, now, now);
    },

    updateToolCall(event: ToolCall): void {
      const now = new Date(event.timestamp).toISOString();
      updateToolCallStmt.run(event.status, event.output ?? null, event.error ?? null, event.durationMs ?? null, now, event.toolCallId);
    },

    insertCostUpdate(event: CostUpdate): void {
      const now = new Date(event.timestamp).toISOString();
      insertCostStmt.run(crypto.randomUUID(), event.sessionId, event.turnIndex, event.inputTokens, event.outputTokens, event.cacheReadTokens ?? null, event.cacheWriteTokens ?? null, event.totalCostUsd, event.modelId, now);
    },

    insertSubagentSpawn(event: SubagentSpawn): void {
      const now = new Date(event.timestamp).toISOString();
      insertSubagentStmt.run(crypto.randomUUID(), event.sessionId, event.turnIndex, event.parentToolCallId, event.subagentSessionId, event.description, now);
    },

    getTurns(sessionId: SessionId): Turn[] {
      return db
        .query<Turn, [string]>('SELECT * FROM turns WHERE session_id = ? ORDER BY turn_index')
        .all(sessionId);
    },

    getToolCalls(sessionId: SessionId, turnIndex?: number): ToolCall[] {
      if (turnIndex !== undefined) {
        const rows = db
          .query<{ id: string; session_id: string; turn_index: number; tool_name: string; input: string; status: string; output: string | null; error: string | null; duration_ms: number | null; created_at: string; updated_at: string }, [string, number]>(
            'SELECT * FROM tool_calls WHERE session_id = ? AND turn_index = ? ORDER BY created_at'
          )
          .all(sessionId, turnIndex);
        return rows.map(mapToolCallRow);
      }
      const rows = db
        .query<{ id: string; session_id: string; turn_index: number; tool_name: string; input: string; status: string; output: string | null; error: string | null; duration_ms: number | null; created_at: string; updated_at: string }, [string]>(
          'SELECT * FROM tool_calls WHERE session_id = ? ORDER BY created_at'
        )
        .all(sessionId);
      return rows.map(mapToolCallRow);
    },

    getCostUpdates(sessionId: SessionId): CostUpdate[] {
      const rows = db
        .query<{ id: string; session_id: string; turn_index: number; input_tokens: number; output_tokens: number; cache_read_tokens: number | null; cache_write_tokens: number | null; total_cost_usd: number; model_id: string; created_at: string }, [string]>(
          'SELECT * FROM cost_updates WHERE session_id = ? ORDER BY created_at'
        )
        .all(sessionId);
      return rows.map((r) => ({
        type: 'agent:cost-update' as const,
        sessionId: SessionId(r.session_id),
        turnIndex: r.turn_index,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens ?? undefined,
        cacheWriteTokens: r.cache_write_tokens ?? undefined,
        totalCostUsd: r.total_cost_usd,
        modelId: r.model_id,
        timestamp: new Date(r.created_at).getTime(),
      }));
    },

    getTextDeltas(sessionId: SessionId, turnIndex: number): TextDelta[] {
      const rows = db
        .query<{ id: string; session_id: string; turn_index: number; role: string; content: string; created_at: string }, [string, number]>(
          'SELECT * FROM text_deltas WHERE session_id = ? AND turn_index = ? ORDER BY created_at'
        )
        .all(sessionId, turnIndex);
      return rows.map((r) => ({
        type: 'agent:text-delta' as const,
        sessionId: SessionId(r.session_id),
        turnIndex: r.turn_index,
        role: r.role as 'assistant' | 'user',
        content: r.content,
        timestamp: new Date(r.created_at).getTime(),
      }));
    },

    getSubagentSpawns(sessionId: SessionId): SubagentSpawn[] {
      const rows = db
        .query<{ id: string; session_id: string; turn_index: number; parent_tool_call_id: string; subagent_session_id: string; description: string; created_at: string }, [string]>(
          'SELECT * FROM subagent_spawns WHERE session_id = ? ORDER BY created_at'
        )
        .all(sessionId);
      return rows.map((r) => ({
        type: 'agent:subagent-spawn' as const,
        sessionId: SessionId(r.session_id),
        turnIndex: r.turn_index,
        parentToolCallId: r.parent_tool_call_id,
        subagentSessionId: r.subagent_session_id,
        description: r.description,
        timestamp: new Date(r.created_at).getTime(),
      }));
    },

    getSessionTotalCost(sessionId: SessionId): number {
      const result = db
        .query<{ total: number | null }, [string]>(
          'SELECT SUM(total_cost_usd) as total FROM cost_updates WHERE session_id = ?'
        )
        .get(sessionId);
      return result?.total ?? 0;
    },
  };
}

function mapToolCallRow(r: {
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
}): ToolCall {
  return {
    type: 'agent:tool-call',
    sessionId: SessionId(r.session_id),
    turnIndex: r.turn_index,
    toolName: r.tool_name,
    toolCallId: r.id,
    input: JSON.parse(r.input),
    status: r.status as 'running' | 'completed' | 'error',
    output: r.output ?? undefined,
    error: r.error ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    timestamp: new Date(r.created_at).getTime(),
  };
}

// Need to import SessionId constructor for mapping
import { SessionId } from '#shared/kernel/session/session-id';

export const SqliteStructuredEventRepositoryLive = Layer.effect(StructuredEventStore)(
  Effect.gen(function* () {
    const { sqlite } = yield* VigiDatabase;
    return createSqliteStructuredEventRepository(sqlite);
  })
);
```

- [ ] **Step 5: Run tests**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-structured-event-repository.integration.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Run full test suite to ensure no regressions**

```bash
cd packages/app && bun test
```

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/modules/agent-session/application/ports/out/structured-event-store.port.ts packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-structured-event-repository.ts packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-structured-event-repository.integration.test.ts
git commit -m "feat(persistence): add structured event store port and SQLite repository"
```

---

## Phase 2: Structured Channel (Claude SDK Adapter)

### Task 7: Install Claude Agent SDK and Create SDK Adapter

**Files:**
- Modify: `packages/app/package.json`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/claude-sdk.adapter.ts`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/sdk-event-mapper.ts`
- Test: `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/sdk-event-mapper.unit.test.ts`

- [ ] **Step 1: Install the Claude Agent SDK**

```bash
cd packages/app && bun add @anthropic-ai/claude-agent-sdk@0.2.96
```

- [ ] **Step 2: Write failing test for SDK event mapper**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/sdk-event-mapper.unit.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { SessionId } from '#shared/kernel/session/session-id';
import { mapSdkMessage } from '../sdk-event-mapper';

const sessionId = SessionId('sess-1');

describe('mapSdkMessage', () => {
  it('maps system init message to session ID extraction', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'system',
      subtype: 'init',
      session_id: 'claude-sess-abc',
      tools: [],
      model: 'claude-sonnet-4-6',
      cwd: '/tmp',
    });
    expect(result).toEqual({
      kind: 'session-id-detected',
      agentSessionId: 'claude-sess-abc',
    });
  });

  it('maps assistant message to CostUpdate', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'assistant',
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 0,
        },
        model: 'claude-sonnet-4-6',
      },
    });
    expect(result).toEqual({
      kind: 'events',
      events: expect.arrayContaining([
        expect.objectContaining({ type: 'agent:cost-update', inputTokens: 1000 }),
      ]),
    });
  });

  it('maps result message to TurnCompleted + final CostUpdate', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'result',
      subtype: 'success',
      session_id: 'claude-sess-abc',
      total_cost_usd: 0.05,
      usage: { input_tokens: 3000, output_tokens: 1000 },
    });
    expect(result).toEqual({
      kind: 'turn-completed',
      stopReason: 'end_turn',
      totalCostUsd: 0.05,
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/sdk-event-mapper.unit.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement the SDK event mapper**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/sdk-event-mapper.ts`:

```typescript
import type { SessionId } from '#shared/kernel/session/session-id';
import type { StructuredEvent } from '#shared/kernel/session/events';

// SDK message types (subset needed for mapping)
interface SdkSystemInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: unknown[];
  model: string;
  cwd: string;
}

interface SdkAssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    role: string;
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
    >;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    model: string;
  };
}

interface SdkResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  session_id: string;
  total_cost_usd: number;
  usage: { input_tokens: number; output_tokens: number };
}

type SdkMessage = SdkSystemInit | SdkAssistantMessage | SdkResultMessage | { type: string };

export type MapResult =
  | { kind: 'session-id-detected'; agentSessionId: string }
  | { kind: 'events'; events: StructuredEvent[] }
  | { kind: 'turn-completed'; stopReason: 'end_turn' | 'max_tokens' | 'pause' | 'error'; totalCostUsd: number }
  | { kind: 'skip' };

const processedMessageIds = new Set<string>();

export function mapSdkMessage(
  sessionId: SessionId,
  turnIndex: number,
  raw: unknown
): MapResult {
  const msg = raw as SdkMessage;

  if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
    const init = msg as SdkSystemInit;
    return { kind: 'session-id-detected', agentSessionId: init.session_id };
  }

  if (msg.type === 'assistant' && 'message' in msg) {
    const assistant = msg as SdkAssistantMessage;
    const msgId = assistant.message.id;

    // Deduplicate by message ID (parallel tool calls share same ID)
    if (processedMessageIds.has(msgId)) return { kind: 'skip' };
    processedMessageIds.add(msgId);

    const events: StructuredEvent[] = [];
    const now = Date.now();

    // Extract text content
    for (const block of assistant.message.content) {
      if (block.type === 'text') {
        events.push({
          type: 'agent:text-delta',
          sessionId,
          turnIndex,
          role: 'assistant',
          content: block.text,
          timestamp: now,
        });
      } else if (block.type === 'tool_use') {
        events.push({
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: block.name,
          toolCallId: block.id,
          input: block.input,
          status: 'running',
          timestamp: now,
        });
      } else if (block.type === 'tool_result') {
        events.push({
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: '',
          toolCallId: block.tool_use_id,
          input: {},
          status: block.is_error ? 'error' : 'completed',
          output: block.is_error ? undefined : block.content,
          error: block.is_error ? block.content : undefined,
          timestamp: now,
        });
      }
    }

    // Cost from usage
    const usage = assistant.message.usage;
    events.push({
      type: 'agent:cost-update',
      sessionId,
      turnIndex,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
      cacheWriteTokens: usage.cache_creation_input_tokens,
      totalCostUsd: 0, // per-message cost not available; final cost from result
      modelId: assistant.message.model,
      timestamp: now,
    });

    return { kind: 'events', events };
  }

  if (msg.type === 'result') {
    const result = msg as SdkResultMessage;
    return {
      kind: 'turn-completed',
      stopReason: result.subtype === 'success' ? 'end_turn' : 'error',
      totalCostUsd: result.total_cost_usd,
    };
  }

  return { kind: 'skip' };
}

export function resetMessageDedup(): void {
  processedMessageIds.clear();
}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/sdk-event-mapper.unit.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Create the Claude SDK adapter**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/claude-sdk.adapter.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Effect, Stream } from 'effect';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import { AgentRunnerError as AgentRunnerErrorClass } from '#modules/agent-session/domain/errors';
import type { SessionId } from '#shared/kernel/session/session-id';
import type { StructuredEvent } from '#shared/kernel/session/events';
import { mapSdkMessage, resetMessageDedup } from './sdk-event-mapper';

interface SpawnStructuredOptions {
  sessionId: SessionId;
  prompt: string;
  cwd: string;
  autoAdvance: boolean;
  agentSessionId?: string;
  resume?: boolean;
  maxTurns?: number;
  maxBudgetUsd?: number;
}

export function spawnStructured(
  options: SpawnStructuredOptions
): Stream.Stream<StructuredEvent, AgentRunnerError> {
  return Stream.async<StructuredEvent, AgentRunnerError>((emit) => {
    const turnIndex = 0;
    resetMessageDedup();

    const run = async () => {
      try {
        const sdkOptions: Record<string, unknown> = {
          cwd: options.cwd,
          permissionMode: 'default',
        };
        if (options.agentSessionId && options.resume) {
          sdkOptions.resume = options.agentSessionId;
        }
        if (options.maxTurns) sdkOptions.maxTurns = options.maxTurns;
        if (options.maxBudgetUsd) sdkOptions.maxBudgetUsd = options.maxBudgetUsd;

        const iter = query({
          prompt: options.prompt,
          options: sdkOptions,
        });

        for await (const message of iter) {
          const result = mapSdkMessage(options.sessionId, turnIndex, message);

          if (result.kind === 'session-id-detected') {
            // Emit as a lifecycle signal — handled by the use case
            emit.single({
              type: 'agent:turn-started',
              sessionId: options.sessionId,
              turnIndex,
              prompt: options.prompt,
              mode: options.autoAdvance ? 'auto' : 'manual',
              timestamp: Date.now(),
            });
          } else if (result.kind === 'events') {
            for (const event of result.events) {
              emit.single(event);
            }
          } else if (result.kind === 'turn-completed') {
            emit.single({
              type: 'agent:turn-completed',
              sessionId: options.sessionId,
              turnIndex,
              stopReason: result.stopReason,
              timestamp: Date.now(),
            });
          }
        }

        emit.end();
      } catch (err) {
        emit.fail(new AgentRunnerErrorClass({ message: String(err) }));
      }
    };

    run();
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/app/package.json packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/
git commit -m "feat(adapter): add Claude Agent SDK adapter with event mapper"
```

---

### Task 8: Create Spawn Structured Session Use Case

**Files:**
- Create: `packages/app/src/modules/agent-session/application/use-cases/spawn-structured-session.use-case.ts`
- Test: `packages/app/src/modules/agent-session/application/use-cases/__tests__/spawn-structured-session.use-case.unit.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/app/src/modules/agent-session/application/use-cases/__tests__/spawn-structured-session.use-case.unit.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { Effect, Stream } from 'effect';
import { createSpawnStructuredSessionUseCase } from '../spawn-structured-session.use-case';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import type { StructuredEvent } from '#shared/kernel/session/events';
import { makeSessionRepo, makeSessionEventBus } from './test-helpers';

function makeStructuredEventStore() {
  const inserted: unknown[] = [];
  return {
    inserted,
    insertTurn: (e: unknown) => { inserted.push(e); },
    completeTurn: (e: unknown) => { inserted.push(e); },
    insertTextDelta: (e: unknown) => { inserted.push(e); },
    insertToolCall: (e: unknown) => { inserted.push(e); },
    updateToolCall: (e: unknown) => { inserted.push(e); },
    insertCostUpdate: (e: unknown) => { inserted.push(e); },
    insertSubagentSpawn: (e: unknown) => { inserted.push(e); },
    getTurns: () => [],
    getToolCalls: () => [],
    getCostUpdates: () => [],
    getTextDeltas: () => [],
    getSubagentSpawns: () => [],
    getSessionTotalCost: () => 0,
  };
}

describe('SpawnStructuredSession', () => {
  it('creates a session with structured type', async () => {
    const sessionRepo = makeSessionRepo();
    const eventStore = makeStructuredEventStore();

    const useCase = createSpawnStructuredSessionUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
      structuredEventStore: eventStore,
      spawnStructuredFn: () =>
        Stream.make<StructuredEvent>(
          {
            type: 'agent:turn-started',
            sessionId: makeSessionId('test'),
            turnIndex: 0,
            prompt: 'hello',
            mode: 'manual',
            timestamp: Date.now(),
          },
          {
            type: 'agent:turn-completed',
            sessionId: makeSessionId('test'),
            turnIndex: 0,
            stopReason: 'end_turn',
            timestamp: Date.now(),
          }
        ),
    });

    const result = await Effect.runPromise(
      useCase.spawn({
        agentType: 'claude',
        cwd: '/tmp',
        prompt: 'hello',
        autoAdvance: false,
      })
    );

    const session = sessionRepo.findById(result.sessionId);
    expect(session).not.toBeNull();
    expect(session!.sessionType).toBe('structured');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/app && bun test src/modules/agent-session/application/use-cases/__tests__/spawn-structured-session.use-case.unit.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the use case**

Create `packages/app/src/modules/agent-session/application/use-cases/spawn-structured-session.use-case.ts`:

```typescript
import { Effect, Stream } from 'effect';
import type { StructuredEventStoreShape } from '#modules/agent-session/application/ports/out/structured-event-store.port';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import type { AgentType } from '#shared/kernel/session/agent-type';
import type { SessionLifecycleEvent, StructuredEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

interface SpawnStructuredDeps {
  sessionRepo: SessionStoreShape;
  eventPublisher: SessionEventBusShape;
  structuredEventStore: StructuredEventStoreShape;
  spawnStructuredFn: (options: {
    sessionId: SessionId;
    prompt: string;
    cwd: string;
    autoAdvance: boolean;
    agentSessionId?: string;
    resume?: boolean;
  }) => Stream.Stream<StructuredEvent, AgentRunnerError>;
}

export type SpawnStructuredSessionShape = ReturnType<typeof createSpawnStructuredSessionUseCase>;

export function createSpawnStructuredSessionUseCase(deps: SpawnStructuredDeps) {
  const { sessionRepo, eventPublisher, structuredEventStore, spawnStructuredFn } = deps;

  function publishEvents(events: SessionLifecycleEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) =>
        Effect.logWarning('Event publish failed (non-fatal)', cause)
      )
    );
  }

  function persistEvent(event: StructuredEvent): void {
    switch (event.type) {
      case 'agent:turn-started':
        structuredEventStore.insertTurn(event);
        break;
      case 'agent:turn-completed':
        structuredEventStore.completeTurn(event);
        break;
      case 'agent:text-delta':
        structuredEventStore.insertTextDelta(event);
        break;
      case 'agent:tool-call':
        if (event.status === 'running') {
          structuredEventStore.insertToolCall(event);
        } else {
          structuredEventStore.updateToolCall(event);
        }
        break;
      case 'agent:cost-update':
        structuredEventStore.insertCostUpdate(event);
        break;
      case 'agent:subagent-spawn':
        structuredEventStore.insertSubagentSpawn(event);
        break;
    }
  }

  return {
    spawn(props: {
      agentType: AgentType;
      cwd: string;
      prompt: string;
      autoAdvance: boolean;
      gitBranch?: string;
      repoName?: string;
    }): Effect.Effect<{ sessionId: SessionId }, AgentRunnerError> {
      return Effect.gen(function* () {
        const session = Session.create({
          agentType: props.agentType,
          cwd: props.cwd,
          mode: 'prompt',
          sessionType: 'structured',
          autoAdvance: props.autoAdvance,
          gitBranch: props.gitBranch,
          repoName: props.repoName,
        });
        sessionRepo.save(session);
        fireAndForget(publishEvents(session.pullEvents()));

        // Start consuming the structured event stream in a forked fiber
        const stream = spawnStructuredFn({
          sessionId: session.id,
          prompt: props.prompt,
          cwd: props.cwd,
          autoAdvance: props.autoAdvance,
        });

        yield* Effect.forkDaemon(
          Stream.runForEach(stream, (event) =>
            Effect.sync(() => {
              persistEvent(event);
              fireAndForget(eventPublisher.publish(event));

              // Update session aggregate
              if (event.type === 'agent:cost-update') {
                session.addCost(event.totalCostUsd);
                sessionRepo.save(session);
              }
              if (event.type === 'agent:turn-completed') {
                if (event.stopReason === 'end_turn' || event.stopReason === 'pause') {
                  session.markPaused();
                } else if (event.stopReason === 'error') {
                  session.markError('Agent turn ended with error');
                }
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              }
            })
          ).pipe(
            Effect.catchAll((err) =>
              Effect.sync(() => {
                session.markError(String(err));
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              })
            )
          )
        );

        return { sessionId: session.id };
      });
    },

    sendPrompt(
      sessionId: SessionId,
      prompt: string
    ): Effect.Effect<void, AgentRunnerError> {
      return Effect.gen(function* () {
        const session = sessionRepo.findById(sessionId);
        if (!session || session.status !== 'paused') return;

        session.reactivate();
        session.advanceTurn();
        sessionRepo.save(session);
        fireAndForget(publishEvents(session.pullEvents()));

        const stream = spawnStructuredFn({
          sessionId,
          prompt,
          cwd: session.cwd,
          autoAdvance: session.autoAdvance,
          agentSessionId: session.agentSessionId ?? undefined,
          resume: true,
        });

        yield* Effect.forkDaemon(
          Stream.runForEach(stream, (event) =>
            Effect.sync(() => {
              persistEvent(event);
              fireAndForget(eventPublisher.publish(event));

              if (event.type === 'agent:cost-update') {
                session.addCost(event.totalCostUsd);
                sessionRepo.save(session);
              }
              if (event.type === 'agent:turn-completed') {
                if (event.stopReason === 'end_turn' || event.stopReason === 'pause') {
                  session.markPaused();
                } else if (event.stopReason === 'error') {
                  session.markError('Agent turn ended with error');
                }
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              }
            })
          ).pipe(
            Effect.catchAll((err) =>
              Effect.sync(() => {
                session.markError(String(err));
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              })
            )
          )
        );
      });
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/app && bun test src/modules/agent-session/application/use-cases/__tests__/spawn-structured-session.use-case.unit.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/modules/agent-session/application/use-cases/spawn-structured-session.use-case.ts packages/app/src/modules/agent-session/application/use-cases/__tests__/spawn-structured-session.use-case.unit.test.ts
git commit -m "feat(use-case): add spawn-structured-session with event persistence and turn management"
```

---

### Task 9: Add Structured Session API Routes

**Files:**
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/session.api-routes.ts`
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/session.dto.ts`
- Modify: `packages/app/src/dependencies.ts`
- Modify: `packages/app/src/modules/agent-session/dependencies.ts`

- [ ] **Step 1: Add new request schemas to session.dto.ts**

```typescript
export const SpawnStructuredRequestSchema = v.object({
  agentType: v.optional(AgentTypeSchema),
  cwd: v.optional(v.string()),
  prompt: v.string(),
  autoAdvance: v.optional(v.boolean()),
});

export const SendPromptRequestSchema = v.object({
  prompt: v.string(),
});
```

- [ ] **Step 2: Add new routes to session.api-routes.ts**

Add to the deps type:

```typescript
import type { SpawnStructuredSessionShape } from '#modules/agent-session/application/use-cases/spawn-structured-session.use-case';
import type { StructuredEventStoreShape } from '#modules/agent-session/application/ports/out/structured-event-store.port';

type SessionApiRouteDeps = {
  // ...existing
  spawnStructuredSession: SpawnStructuredSessionShape;
  structuredEventStore: StructuredEventStoreShape;
};
```

Add new routes to the returned array:

```typescript
// POST /api/sessions/structured — spawn structured session
jsonRoute(
  'POST',
  '/api/sessions/structured',
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const raw = yield* request.json;
    const parsed = v.safeParse(SpawnStructuredRequestSchema, raw);
    if (!parsed.success) {
      return HttpServerResponse.jsonUnsafe({ error: 'Invalid request body' }, { status: 400 });
    }
    const body = parsed.output;
    const result = yield* spawnStructuredSession.spawn({
      agentType: body.agentType ?? 'claude',
      cwd: expandPath(body.cwd ?? '~'),
      prompt: body.prompt,
      autoAdvance: body.autoAdvance ?? false,
    });
    return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
  })
),

// POST /api/sessions/:id/prompt — send prompt to paused session
jsonRoute(
  'POST',
  '/api/sessions/:id/prompt',
  Effect.gen(function* () {
    const { id: rawId } = yield* HttpRouter.params;
    if (!rawId) return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
    const request = yield* HttpServerRequest.HttpServerRequest;
    const raw = yield* request.json;
    const parsed = v.safeParse(SendPromptRequestSchema, raw);
    if (!parsed.success) return HttpServerResponse.jsonUnsafe({ error: 'Invalid request body' }, { status: 400 });
    yield* spawnStructuredSession.sendPrompt(makeSessionId(rawId), parsed.output.prompt);
    return HttpServerResponse.jsonUnsafe({ ok: true });
  })
),

// POST /api/sessions/:id/pause — force pause
HttpRouter.route(
  'POST',
  '/api/sessions/:id/pause',
  Effect.gen(function* () {
    const { id: rawId } = yield* HttpRouter.params;
    if (!rawId) return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
    const sessionId = makeSessionId(rawId);
    const session = sessionQueries.findById(sessionId);
    if (!session) return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
    // Kill the SDK process — the stream handler will transition to paused
    ptyManager.kill(sessionId);
    return HttpServerResponse.jsonUnsafe({ ok: true });
  })
),

// POST /api/sessions/:id/abandon
HttpRouter.route(
  'POST',
  '/api/sessions/:id/abandon',
  Effect.gen(function* () {
    const { id: rawId } = yield* HttpRouter.params;
    if (!rawId) return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
    const sessionId = makeSessionId(rawId);
    const session = sessionQueries.findById(sessionId);
    if (!session) return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
    if (session.isActive) ptyManager.kill(sessionId);
    // Use case will handle status transition
    return HttpServerResponse.jsonUnsafe({ ok: true });
  })
),

// POST /api/sessions/:id/archive
HttpRouter.route(
  'POST',
  '/api/sessions/:id/archive',
  Effect.gen(function* () {
    const { id: rawId } = yield* HttpRouter.params;
    if (!rawId) return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
    const sessionId = makeSessionId(rawId);
    const session = sessionQueries.findById(sessionId);
    if (!session) return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
    // Archive via domain — the session.archive() method handles validation
    return HttpServerResponse.jsonUnsafe({ ok: true });
  })
),

// GET /api/sessions/:id/events — structured events
HttpRouter.route(
  'GET',
  '/api/sessions/:id/events',
  Effect.gen(function* () {
    const { id: rawId } = yield* HttpRouter.params;
    if (!rawId) return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
    const sessionId = makeSessionId(rawId);
    const toolCalls = structuredEventStore.getToolCalls(sessionId);
    const costUpdates = structuredEventStore.getCostUpdates(sessionId);
    return HttpServerResponse.jsonUnsafe({ toolCalls, costUpdates });
  })
),

// GET /api/sessions/:id/turns
HttpRouter.route(
  'GET',
  '/api/sessions/:id/turns',
  Effect.gen(function* () {
    const { id: rawId } = yield* HttpRouter.params;
    if (!rawId) return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
    const turns = structuredEventStore.getTurns(makeSessionId(rawId));
    return HttpServerResponse.jsonUnsafe({ turns });
  })
),
```

- [ ] **Step 3: Wire new dependencies into agent-session module**

Update `packages/app/src/modules/agent-session/dependencies.ts` to include `StructuredEventStore` and the new use case.

Add `SqliteStructuredEventRepositoryLive` to `AgentSessionInfraLive`.

Create the `spawnStructuredSession` use case in the Effect.gen block, wiring in the `spawnStructured` function from the SDK adapter.

Export it via `AgentSessionServices`.

- [ ] **Step 4: Wire into root dependencies.ts**

In `packages/app/src/dependencies.ts`, pass `spawnStructuredSession` and `structuredEventStore` to `createSessionApiRoutes`.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/app && bun test
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/modules/agent-session/ packages/app/src/dependencies.ts
git commit -m "feat(api): add structured session routes — spawn, prompt, pause, abandon, archive, events, turns"
```

---

## Phase 3: Hook Channel

### Task 10: Create Hook Receiver Endpoint

**Files:**
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/hooks.routes.ts`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/hook-event-mapper.ts`
- Test: `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/hook-event-mapper.unit.test.ts`

- [ ] **Step 1: Write failing test for hook event mapper**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/hook-event-mapper.unit.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { SessionId } from '#shared/kernel/session/session-id';
import { mapHookEvent } from '../hook-event-mapper';

describe('mapHookEvent', () => {
  const sessionId = SessionId('sess-1');

  it('maps tool_use hook to ToolCall running', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'tool_use',
      tool_name: 'Read',
      tool_call_id: 'tc-1',
      input: { file_path: '/foo.ts' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('agent:tool-call');
    expect((result[0] as { status: string }).status).toBe('running');
  });

  it('maps tool_result hook to ToolCall completed', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'tool_result',
      tool_call_id: 'tc-1',
      content: 'file contents',
      is_error: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('agent:tool-call');
    expect((result[0] as { status: string }).status).toBe('completed');
  });

  it('returns empty for unknown hook type', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'unknown_event',
    });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/hook-event-mapper.unit.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement hook event mapper**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/hook-event-mapper.ts`:

```typescript
import type { SessionId } from '#shared/kernel/session/session-id';
import type { StructuredEvent } from '#shared/kernel/session/events';

interface HookPayload {
  type: string;
  [key: string]: unknown;
}

export function mapHookEvent(
  sessionId: SessionId,
  turnIndex: number,
  payload: HookPayload
): StructuredEvent[] {
  const now = Date.now();

  switch (payload.type) {
    case 'tool_use':
      return [
        {
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: payload.tool_name as string,
          toolCallId: payload.tool_call_id as string,
          input: (payload.input as Record<string, unknown>) ?? {},
          status: 'running',
          timestamp: now,
        },
      ];

    case 'tool_result':
      return [
        {
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: '',
          toolCallId: payload.tool_call_id as string,
          input: {},
          status: payload.is_error ? 'error' : 'completed',
          output: payload.is_error ? undefined : (payload.content as string),
          error: payload.is_error ? (payload.content as string) : undefined,
          timestamp: now,
        },
      ];

    case 'assistant_message':
      return [
        {
          type: 'agent:text-delta',
          sessionId,
          turnIndex,
          role: 'assistant',
          content: payload.content as string,
          timestamp: now,
        },
      ];

    case 'cost_update':
      return [
        {
          type: 'agent:cost-update',
          sessionId,
          turnIndex,
          inputTokens: (payload.input_tokens as number) ?? 0,
          outputTokens: (payload.output_tokens as number) ?? 0,
          cacheReadTokens: payload.cache_read_tokens as number | undefined,
          cacheWriteTokens: payload.cache_write_tokens as number | undefined,
          totalCostUsd: (payload.total_cost_usd as number) ?? 0,
          modelId: (payload.model_id as string) ?? 'unknown',
          timestamp: now,
        },
      ];

    case 'subagent_spawn':
      return [
        {
          type: 'agent:subagent-spawn',
          sessionId,
          turnIndex,
          parentToolCallId: payload.parent_tool_call_id as string,
          subagentSessionId: payload.subagent_session_id as string,
          description: (payload.description as string) ?? '',
          timestamp: now,
        },
      ];

    default:
      return [];
  }
}
```

- [ ] **Step 4: Create hook routes**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/hooks.routes.ts`:

```typescript
import { Effect } from 'effect';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { StructuredEventStoreShape } from '#modules/agent-session/application/ports/out/structured-event-store.port';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { mapHookEvent } from '#modules/agent-session/infrastructure/adapters/out/agents/hook-event-mapper';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';

type HookRouteDeps = {
  sessionQueries: SessionQueriesShape;
  eventPublisher: SessionEventBusShape;
  structuredEventStore: StructuredEventStoreShape;
};

export function createHookRoutes(deps: HookRouteDeps) {
  const { sessionQueries, eventPublisher, structuredEventStore } = deps;

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) =>
        Effect.logWarning('Hook event publish failed', cause)
      )
    );
  }

  return [
    HttpRouter.route(
      'POST',
      '/api/hooks',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const raw = yield* request.json;
        const payload = raw as { type: string; session_id?: string; cwd?: string; [key: string]: unknown };

        // Find matching vigie session
        const allSessions = sessionQueries.listAll();
        const match = allSessions.find(
          (s) =>
            (payload.session_id && s.agentSessionId === payload.session_id) ||
            (payload.cwd && s.cwd === payload.cwd && s.isActive)
        );

        if (!match) {
          return HttpServerResponse.jsonUnsafe({ ok: true, matched: false });
        }

        const events = mapHookEvent(match.id, match.currentTurnIndex, payload);

        for (const event of events) {
          // Persist
          switch (event.type) {
            case 'agent:tool-call':
              if (event.status === 'running') structuredEventStore.insertToolCall(event);
              else structuredEventStore.updateToolCall(event);
              break;
            case 'agent:text-delta':
              structuredEventStore.insertTextDelta(event);
              break;
            case 'agent:cost-update':
              structuredEventStore.insertCostUpdate(event);
              break;
            case 'agent:subagent-spawn':
              structuredEventStore.insertSubagentSpawn(event);
              break;
          }

          // Broadcast
          fireAndForget(eventPublisher.publish(event));
        }

        return HttpServerResponse.jsonUnsafe({ ok: true, matched: true, eventsProcessed: events.length });
      })
    ),
  ];
}
```

- [ ] **Step 5: Wire hook routes into dependencies.ts**

In `packages/app/src/dependencies.ts`, import and create hook routes, add to the routes array.

- [ ] **Step 6: Run tests**

```bash
cd packages/app && bun test
```

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/in/hooks.routes.ts packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/hook-event-mapper.ts packages/app/src/modules/agent-session/infrastructure/adapters/out/agents/__tests__/ packages/app/src/dependencies.ts
git commit -m "feat(hooks): add hook receiver endpoint with event mapper for interactive session monitoring"
```

---

### Task 11: Hook Auto-Configuration (Guided Setup)

**Files:**
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/out/hook-config-manager.ts`
- Create: `packages/app/src/shell/infrastructure/adapters/in/commands/hooks.command.ts`
- Test: `packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/hook-config-manager.unit.test.ts`

- [ ] **Step 1: Write failing test for hook config manager**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/hook-config-manager.unit.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installHooks, uninstallHooks, getHookStatus } from '../hook-config-manager';

describe('hookConfigManager', () => {
  it('installs vigie hooks into Claude Code settings', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vigie-test-'));
    writeFileSync(join(tempDir, 'settings.json'), '{}');

    installHooks(tempDir, 'http://localhost:19191');

    const settings = JSON.parse(readFileSync(join(tempDir, 'settings.json'), 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PostToolUse).toBeDefined();
  });

  it('uninstalls vigie hooks', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vigie-test-'));
    writeFileSync(join(tempDir, 'settings.json'), '{}');

    installHooks(tempDir, 'http://localhost:19191');
    uninstallHooks(tempDir);

    const settings = JSON.parse(readFileSync(join(tempDir, 'settings.json'), 'utf-8'));
    expect(settings.hooks.PostToolUse).toBeUndefined();
  });

  it('reports installed status correctly', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vigie-test-'));
    writeFileSync(join(tempDir, 'settings.json'), '{}');

    expect(getHookStatus(tempDir).installed).toBe(false);
    installHooks(tempDir, 'http://localhost:19191');
    expect(getHookStatus(tempDir).installed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/__tests__/hook-config-manager.unit.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement hook config manager**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/out/hook-config-manager.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VIGIE_HOOK_MARKER = '__vigie_managed__';

interface HookEntry {
  type: 'command';
  command: string;
  __vigie_managed__?: boolean;
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

function readSettings(claudeDir: string): ClaudeSettings {
  const path = join(claudeDir, 'settings.json');
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8')) as ClaudeSettings;
}

function writeSettings(claudeDir: string, settings: ClaudeSettings): void {
  const path = join(claudeDir, 'settings.json');
  writeFileSync(path, JSON.stringify(settings, null, 2));
}

export function installHooks(claudeDir: string, vigieUrl: string): void {
  const settings = readSettings(claudeDir);
  if (!settings.hooks) settings.hooks = {};

  const hookTypes = ['PostToolUse', 'PreToolUse', 'PostAssistantMessage'] as const;

  for (const hookType of hookTypes) {
    const entries = settings.hooks[hookType] ?? [];
    // Remove existing vigie hooks
    const cleaned = entries.filter((e) => !(e as HookEntry)[VIGIE_HOOK_MARKER]);
    cleaned.push({
      type: 'command',
      command: `curl -s -X POST ${vigieUrl}/api/hooks -H 'Content-Type: application/json' -d '{"type":"${hookType.toLowerCase()}","session_id":"$CLAUDE_SESSION_ID","cwd":"$CLAUDE_CWD"}'`,
      [VIGIE_HOOK_MARKER]: true,
    } as HookEntry);
    settings.hooks[hookType] = cleaned;
  }

  writeSettings(claudeDir, settings);
}

export function uninstallHooks(claudeDir: string): void {
  const settings = readSettings(claudeDir);
  if (!settings.hooks) return;

  for (const hookType of Object.keys(settings.hooks)) {
    const entries = settings.hooks[hookType];
    settings.hooks[hookType] = entries.filter((e) => !(e as HookEntry)[VIGIE_HOOK_MARKER]);
    if (settings.hooks[hookType].length === 0) {
      delete settings.hooks[hookType];
    }
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(claudeDir, settings);
}

export function getHookStatus(claudeDir: string): { installed: boolean; hookCount: number } {
  const settings = readSettings(claudeDir);
  if (!settings.hooks) return { installed: false, hookCount: 0 };

  let count = 0;
  for (const entries of Object.values(settings.hooks)) {
    count += entries.filter((e) => (e as HookEntry)[VIGIE_HOOK_MARKER]).length;
  }

  return { installed: count > 0, hookCount: count };
}

export function isClaudeCodeInstalled(): boolean {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return existsSync(join(homeDir, '.claude'));
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/out/__tests__/hook-config-manager.unit.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Create CLI hooks command**

Create `packages/app/src/shell/infrastructure/adapters/in/commands/hooks.command.ts`:

```typescript
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  installHooks,
  uninstallHooks,
  getHookStatus,
} from '#modules/agent-session/infrastructure/adapters/out/hook-config-manager';

const CLAUDE_DIR = join(homedir(), '.claude');
const VIGIE_URL = 'http://localhost:19191';

export function hooksStatusCommand(): void {
  const status = getHookStatus(CLAUDE_DIR);
  if (status.installed) {
    console.log(`vigie hooks: installed (${status.hookCount} hooks)`);
  } else {
    console.log('vigie hooks: not installed');
  }
}

export function hooksInstallCommand(): void {
  installHooks(CLAUDE_DIR, VIGIE_URL);
  console.log('vigie hooks installed into Claude Code settings');
}

export function hooksUninstallCommand(): void {
  uninstallHooks(CLAUDE_DIR);
  console.log('vigie hooks removed from Claude Code settings');
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/out/hook-config-manager.ts packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/hook-config-manager.unit.test.ts packages/app/src/shell/infrastructure/adapters/in/commands/hooks.command.ts
git commit -m "feat(hooks): add hook auto-configuration — install, uninstall, status CLI commands"
```

---

## Phase 4: Dashboard v2

### Task 12: Restructure Frontend by Feature

**Files:**
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/` (directory)
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/` (directory)
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/spawn/` (directory)
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/store.ts`
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/ws-sync.ts`

- [ ] **Step 1: Expand the store with new atoms**

Modify `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/store.ts`:

```typescript
import { atom, map } from 'nanostores';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import type { StructuredEvent } from '#shared/kernel/session/events';

export const $sessions = atom<AgentSession[]>([]);
export const $selectedId = atom<string | null>(null);
export const $homedir = atom<string>('/');
export const $view = atom<'kanban' | 'detail'>('kanban');
export const $eventFeed = map<Record<string, StructuredEvent[]>>({});

export function addEventToFeed(sessionId: string, event: StructuredEvent): void {
  const current = $eventFeed.get();
  const existing = current[sessionId] ?? [];
  $eventFeed.setKey(sessionId, [...existing, event]);
}
```

- [ ] **Step 2: Refactor ws-sync.ts to thin dispatcher with Valibot validation**

Replace the body of `applyWsMessage` in `ws-sync.ts`:

```typescript
import * as v from 'valibot';
import { SessionEventSchema, type SessionEvent, type StructuredEvent } from '#shared/kernel/session/events';
import { $sessions, $selectedId, $view, addEventToFeed } from './store';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';

type SnapshotMessage = { type: 'snapshot'; sessions: AgentSession[] };

function isSnapshot(msg: unknown): msg is SnapshotMessage {
  return typeof msg === 'object' && msg !== null && (msg as { type: string }).type === 'snapshot';
}

function pickId(sessions: AgentSession[], currentId: string | null): string | null {
  if (currentId !== null && sessions.some((s) => s.id === currentId)) return currentId;
  return sessions.find((s) => s.status === 'active')?.id ?? sessions[0]?.id ?? null;
}

export function applyWsMessage(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  // Handle snapshot (not a SessionEvent)
  if (isSnapshot(parsed)) {
    $sessions.set(parsed.sessions);
    $selectedId.set(pickId(parsed.sessions, $selectedId.get()));
    return;
  }

  // Validate against SessionEvent schema
  const result = v.safeParse(SessionEventSchema, parsed);
  if (!result.success) return;

  const event = result.output;
  applyLifecycleEvent(event);
  applyStructuredEvent(event);
}

function applyLifecycleEvent(event: SessionEvent): void {
  switch (event.type) {
    case 'session:started':
      fetch('/api/sessions')
        .then((r) => r.json() as Promise<{ sessions: AgentSession[] }>)
        .then(({ sessions }) => {
          $sessions.set(sessions);
          $selectedId.set(pickId(sessions, $selectedId.get()));
        })
        .catch(() => {});
      break;

    case 'session:ended':
      $sessions.set(
        $sessions.get().map((s) =>
          s.id === event.sessionId
            ? { ...s, status: 'ended' as const, resumable: event.resumable, exitCode: event.exitCode }
            : s
        )
      );
      break;

    case 'session:deleted': {
      const remaining = $sessions.get().filter((s) => s.id !== event.sessionId);
      $sessions.set(remaining);
      if ($selectedId.get() === event.sessionId) $selectedId.set(pickId(remaining, null));
      break;
    }

    case 'sessions:cleared': {
      const active = $sessions.get().filter((s) => s.status === 'active');
      $sessions.set(active);
      break;
    }

    case 'session:resumable-changed':
      $sessions.set(
        $sessions.get().map((s) =>
          s.id === event.sessionId ? { ...s, resumable: event.resumable } : s
        )
      );
      break;
  }
}

function applyStructuredEvent(event: SessionEvent): void {
  if (
    event.type === 'agent:text-delta' ||
    event.type === 'agent:tool-call' ||
    event.type === 'agent:cost-update' ||
    event.type === 'agent:subagent-spawn' ||
    event.type === 'agent:turn-started' ||
    event.type === 'agent:turn-completed'
  ) {
    addEventToFeed(event.sessionId, event as StructuredEvent);

    // Update session cost in local state
    if (event.type === 'agent:cost-update') {
      $sessions.set(
        $sessions.get().map((s) =>
          s.id === event.sessionId
            ? { ...s, totalCostUsd: (s.totalCostUsd ?? 0) + event.totalCostUsd }
            : s
        )
      );
    }
  }
}
```

- [ ] **Step 3: Run existing ws-sync tests to catch breakage**

```bash
cd packages/app && bun test src/modules/agent-session/infrastructure/adapters/in/ui/__tests__/ws-sync.unit.test.ts
```

Fix any failures from the refactor.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/
git commit -m "refactor(ui): restructure frontend — thin ws-sync dispatcher, Valibot validation, feature-based store"
```

---

### Task 13: Kanban Board Island

**Files:**
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanBoard.island.tsx`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanColumn.tsx`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanCard.tsx`

- [ ] **Step 1: Create KanbanCard component**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanCard.tsx`:

```tsx
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import type { StructuredEvent, ToolCall } from '#shared/kernel/session/events';
import { $selectedId, $view } from '../store';

interface KanbanCardProps {
  session: AgentSession;
  events: StructuredEvent[];
  onAction: (action: string, sessionId: string) => void;
}

function getActivityMode(session: AgentSession, events: StructuredEvent[]): string {
  if (session.status === 'paused') return 'Waiting';
  if (session.status !== 'active') return '';

  // Derive from most recent tool calls in current turn
  const recentTools = events
    .filter((e): e is ToolCall => e.type === 'agent:tool-call' && e.sessionId === session.id)
    .slice(-5);

  if (recentTools.length === 0) return 'Other';

  const lastName = recentTools[recentTools.length - 1].toolName;
  const planningTools = ['Read', 'Grep', 'Glob', 'WebSearch'];
  const implementingTools = ['Edit', 'Write'];

  if (planningTools.includes(lastName)) return 'Planning';
  if (implementingTools.includes(lastName)) return 'Implementing';
  if (lastName === 'Bash' && recentTools.some((t) => /test|spec|check/.test(JSON.stringify(t.input)))) return 'Testing';
  if (lastName === 'Read' && recentTools.some((t) => t.toolName === 'Edit')) return 'Reviewing';
  return 'Other';
}

function formatCost(usd: number | undefined): string {
  if (!usd || usd === 0) return '$0.00';
  return `$${usd.toFixed(4)}`;
}

export function KanbanCard({ session, events, onAction }: KanbanCardProps) {
  const activityMode = getActivityMode(session, events);

  return (
    <div
      className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 cursor-pointer hover:border-neutral-500 transition-colors"
      onClick={() => {
        $selectedId.set(session.id);
        $view.set('detail');
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-neutral-400 truncate max-w-[120px]">
          {session.id.slice(0, 8)}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">
          {session.agentType}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700/50 text-neutral-400">
          {session.sessionType ?? 'interactive'}
        </span>
        {activityMode && (
          <span className="text-xs text-teal-400">{activityMode}</span>
        )}
      </div>

      <div className="text-xs text-neutral-500 truncate mb-1">{session.cwd}</div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{formatCost(session.totalCostUsd)}</span>
        <span>Turn {session.currentTurnIndex ?? 0}</span>
      </div>

      {session.status === 'active' && (
        <div className="mt-2 flex gap-1">
          <button
            className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50"
            onClick={(e) => { e.stopPropagation(); onAction('kill', session.id); }}
          >
            Kill
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create KanbanColumn component**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanColumn.tsx`:

```tsx
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  title: string;
  sessions: AgentSession[];
  onAction: (action: string, sessionId: string) => void;
}

export function KanbanColumn({ title, sessions, onAction }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium text-neutral-300">{title}</h3>
        <span className="text-xs text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
          {sessions.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-180px)]">
        {sessions.map((s) => (
          <KanbanCard key={s.id} session={s} onAction={onAction} />
        ))}
        {sessions.length === 0 && (
          <div className="text-xs text-neutral-600 text-center py-4">No sessions</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create KanbanBoard island**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanBoard.island.tsx`:

```tsx
import { useStore } from '@nanostores/react';
import { $sessions } from '../store';
import { KanbanColumn } from './KanbanColumn';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';

type StatusGroup = 'Queued' | 'Running' | 'Paused' | 'Completed' | 'Stopped' | 'Archived';

function groupByStatus(sessions: AgentSession[]): Record<StatusGroup, AgentSession[]> {
  const groups: Record<StatusGroup, AgentSession[]> = {
    Queued: [],
    Running: [],
    Paused: [],
    Completed: [],
    Stopped: [],
    Archived: [],
  };

  for (const s of sessions) {
    switch (s.status) {
      case 'registering':
        groups.Queued.push(s);
        break;
      case 'active':
        groups.Running.push(s);
        break;
      case 'paused':
        groups.Paused.push(s);
        break;
      case 'ended':
        groups.Completed.push(s);
        break;
      case 'error':
      case 'abandoned':
      case 'killed':
        groups.Stopped.push(s);
        break;
      case 'archived':
        groups.Archived.push(s);
        break;
    }
  }

  return groups;
}

function handleAction(action: string, sessionId: string): void {
  const url = `/api/sessions/${sessionId}/${action}`;
  fetch(url, { method: 'POST' }).catch(() => {});
}

export function KanbanBoard() {
  const sessions = useStore($sessions);
  const groups = groupByStatus(sessions);

  return (
    <div className="flex gap-4 p-4 overflow-x-auto h-full">
      <KanbanColumn title="Queued" sessions={groups.Queued} onAction={handleAction} />
      <KanbanColumn title="Running" sessions={groups.Running} onAction={handleAction} />
      <KanbanColumn title="Paused" sessions={groups.Paused} onAction={handleAction} />
      <KanbanColumn title="Completed" sessions={groups.Completed} onAction={handleAction} />
      <KanbanColumn title="Stopped" sessions={groups.Stopped} onAction={handleAction} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/kanban/
git commit -m "feat(ui): add KanbanBoard island with status columns and session cards"
```

---

### Task 14: Session Detail Island (Structured + Interactive Views)

**Files:**
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/StructuredDetail.tsx`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/EventFeed.tsx`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/PromptInput.tsx`
- Create: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/SessionDetailV2.island.tsx`

- [ ] **Step 1: Create EventFeed component**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/EventFeed.tsx`:

```tsx
import type { StructuredEvent } from '#shared/kernel/session/events';

interface EventFeedProps {
  events: StructuredEvent[];
}

function renderEvent(event: StructuredEvent, index: number) {
  switch (event.type) {
    case 'agent:tool-call':
      return (
        <div key={index} className="flex items-start gap-2 py-1.5 border-b border-neutral-800">
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            event.status === 'running' ? 'bg-yellow-900/30 text-yellow-400' :
            event.status === 'completed' ? 'bg-green-900/30 text-green-400' :
            'bg-red-900/30 text-red-400'
          }`}>
            {event.status === 'running' ? '...' : event.status === 'completed' ? '✓' : '✗'}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-neutral-200 font-mono">{event.toolName}</span>
            {event.durationMs && (
              <span className="text-xs text-neutral-500 ml-2">{event.durationMs}ms</span>
            )}
          </div>
        </div>
      );

    case 'agent:text-delta':
      return (
        <div key={index} className="py-1 text-sm text-neutral-300">
          {event.content}
        </div>
      );

    case 'agent:cost-update':
      return (
        <div key={index} className="py-1 text-xs text-neutral-500 flex gap-4">
          <span>{event.inputTokens} in / {event.outputTokens} out</span>
          <span>{event.modelId}</span>
        </div>
      );

    case 'agent:subagent-spawn':
      return (
        <div key={index} className="py-1 text-xs text-teal-400">
          Subagent: {event.description}
        </div>
      );

    case 'agent:turn-started':
      return (
        <div key={index} className="py-2 text-xs text-neutral-400 border-t border-neutral-700 mt-2">
          Turn {event.turnIndex}: {event.prompt.slice(0, 100)}
        </div>
      );

    case 'agent:turn-completed':
      return (
        <div key={index} className="py-1 text-xs text-neutral-500">
          Turn completed: {event.stopReason}
        </div>
      );

    default:
      return null;
  }
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <div className="flex flex-col overflow-y-auto p-3 h-full">
      {events.length === 0 && (
        <div className="text-xs text-neutral-600 text-center py-8">No events yet</div>
      )}
      {events.map((event, i) => renderEvent(event, i))}
    </div>
  );
}
```

- [ ] **Step 2: Create PromptInput component**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/PromptInput.tsx`:

```tsx
import { useState } from 'react';

interface PromptInputProps {
  sessionId: string;
  disabled: boolean;
}

export function PromptInput({ sessionId, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || disabled || sending) return;
    setSending(true);
    try {
      await fetch(`/api/sessions/${sessionId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      setPrompt('');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-neutral-700">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={disabled ? 'Session running...' : 'Send next prompt...'}
        disabled={disabled || sending}
        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-teal-600 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || sending || !prompt.trim()}
        className="px-4 py-2 bg-teal-700 text-sm text-white rounded hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create SessionDetailV2 island**

Create `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/SessionDetailV2.island.tsx`:

```tsx
import { useStore } from '@nanostores/react';
import { $sessions, $selectedId, $view, $eventFeed } from '../store';
import { EventFeed } from './EventFeed';
import { PromptInput } from './PromptInput';
import { InteractiveTerminal } from '../InteractiveTerminal.island';

export function SessionDetailV2() {
  const sessions = useStore($sessions);
  const selectedId = useStore($selectedId);
  const view = useStore($view);
  const eventFeedMap = useStore($eventFeed);

  if (view !== 'detail' || !selectedId) return null;

  const session = sessions.find((s) => s.id === selectedId);
  if (!session) return null;

  const events = eventFeedMap[session.id] ?? [];
  const isStructured = session.sessionType === 'structured';
  const isPaused = session.status === 'paused';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <button
            className="text-sm text-neutral-400 hover:text-neutral-200"
            onClick={() => $view.set('kanban')}
          >
            ← Back
          </button>
          <span className="text-sm font-mono text-neutral-300">{session.id.slice(0, 12)}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
            {session.sessionType ?? 'interactive'}
          </span>
          <span className="text-xs text-neutral-500">{session.status}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>${(session.totalCostUsd ?? 0).toFixed(4)}</span>
          <span>Turn {session.currentTurnIndex ?? 0}</span>
        </div>
      </div>

      {/* Content */}
      {isStructured ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <EventFeed events={events} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: structured events from hooks */}
          <div className="w-1/2 border-r border-neutral-700 overflow-y-auto">
            <div className="p-2 text-xs text-neutral-500 bg-neutral-800/50 border-b border-neutral-700">
              Structured events via hooks (best effort)
            </div>
            <EventFeed events={events} />
          </div>
          {/* Right: xterm.js escape hatch */}
          <div className="w-1/2">
            <InteractiveTerminal sessionId={session.id} />
          </div>
        </div>
      )}

      {/* Prompt input for structured paused sessions */}
      {isStructured && (
        <PromptInput sessionId={session.id} disabled={!isPaused} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/session-detail/
git commit -m "feat(ui): add SessionDetailV2 island — structured event feed, prompt input, xterm escape hatch"
```

---

### Task 15: Spawn Session Form v2

**Files:**
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/SpawnSessionForm.island.tsx`

- [ ] **Step 1: Update SpawnSessionForm with session type toggle**

Add to the existing form:
- Session type toggle: "Structured" (default) / "Interactive"
- Prompt input (shown for structured, hidden for interactive)
- Auto-advance toggle (shown for structured, default off)
- When structured: POST to `/api/sessions/structured` with `{ prompt, autoAdvance, agentType, cwd }`
- When interactive: POST to `/api/sessions` as before

Key changes:
```tsx
const [sessionType, setSessionType] = useState<'structured' | 'interactive'>('structured');
const [prompt, setPrompt] = useState('');
const [autoAdvance, setAutoAdvance] = useState(false);

// In submit handler:
if (sessionType === 'structured') {
  await fetch('/api/sessions/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentType, cwd: path, prompt, autoAdvance }),
  });
} else {
  await fetch('/api/sessions', { /* existing logic */ });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/in/ui/SpawnSessionForm.island.tsx
git commit -m "feat(ui): update SpawnSessionForm with session type toggle and prompt input"
```

---

### Task 16: Wire New Islands into Dashboard Page and Client Entry

**Files:**
- Modify: `packages/app/src/pages/dashboard.page.tsx`
- Modify: `packages/app/src/pages/client-entry.tsx`

- [ ] **Step 1: Update dashboard.page.tsx**

Replace the current sidebar + detail layout with:
- Top bar: global stats (active count, total cost)
- Main area: mount points for KanbanBoard and SessionDetailV2
- SpawnForm accessible via a "New Session" button

The SSR page provides the shell; islands hydrate the interactive parts.

```tsx
// Key layout change:
<div className="flex flex-col h-screen bg-neutral-900 text-neutral-100">
  {/* Top bar */}
  <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
    <div className="flex items-center gap-3">
      <span className="text-lg font-semibold">vigie</span>
      <span className="text-xs text-neutral-500">agent supervisor</span>
    </div>
    <div id="global-stats" className="flex items-center gap-4 text-xs text-neutral-400" />
    <button id="spawn-trigger" className="px-3 py-1.5 bg-teal-700 text-sm rounded hover:bg-teal-600">
      New Session
    </button>
  </header>

  {/* Main */}
  <main className="flex-1 overflow-hidden">
    <div id="kanban-app" className="h-full" />
    <div id="session-detail-app" className="h-full" />
  </main>

  {/* Spawn modal */}
  <div id="spawn-form-app" />
</div>
```

- [ ] **Step 2: Update client-entry.tsx to mount new islands**

```tsx
import { createRoot } from 'react-dom/client';
import { KanbanBoard } from '#modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanBoard.island';
import { SessionDetailV2 } from '#modules/agent-session/infrastructure/adapters/in/ui/session-detail/SessionDetailV2.island';
import { SpawnSessionForm } from '#modules/agent-session/infrastructure/adapters/in/ui/SpawnSessionForm.island';
import { init } from '#modules/agent-session/infrastructure/adapters/in/ui/ws-sync';

function mount(id: string, component: React.ReactNode): void {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(component);
}

init();
mount('kanban-app', <KanbanBoard />);
mount('session-detail-app', <SessionDetailV2 />);
mount('spawn-form-app', <SpawnSessionForm />);
```

- [ ] **Step 3: Build and verify**

```bash
cd packages/app && bun run build:client
```

Expected: Build succeeds.

- [ ] **Step 4: Run full test suite**

```bash
cd packages/app && bun test
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/
git commit -m "feat(ui): wire KanbanBoard, SessionDetailV2, and updated SpawnForm into dashboard"
```

---

### Task 17: Update Session DTO Status List and Verify End-to-End

**Files:**
- Modify: `packages/app/src/modules/agent-session/infrastructure/adapters/in/session.dto.ts`
- Run: full verify pipeline

- [ ] **Step 1: Update AgentSessionSchema status picklist**

In `session.dto.ts`, update the status field:

```typescript
status: v.picklist(['registering', 'active', 'paused', 'ended', 'error', 'abandoned', 'killed', 'archived']),
```

- [ ] **Step 2: Run the full verify pipeline**

```bash
cd packages/app && bun run typecheck && bun test
```

Fix any type errors from the expanded status type propagating through the codebase.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(m0): complete M0 structured streaming — SDK adapter, hooks, kanban dashboard"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| **Phase 1: Foundation** | Tasks 1–6 | Kysely migration, expanded domain model, structured event types + persistence |
| **Phase 2: Structured Channel** | Tasks 7–9 | Claude SDK adapter, spawn-structured use case, new API routes |
| **Phase 3: Hook Channel** | Tasks 10–11 | Hook receiver endpoint, event mapper, guided hook setup CLI |
| **Phase 4: Dashboard v2** | Tasks 12–17 | Kanban overview, session detail with event feed + xterm, refactored ws-sync |
