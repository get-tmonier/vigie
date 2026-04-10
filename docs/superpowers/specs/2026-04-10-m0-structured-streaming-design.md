# M0 — Structured Streaming

**Date**: 2026-04-10
**Status**: Draft
**Branch**: `feat/structured-streaming`

## Goal

Add a structured event layer to vigie. The browser dashboard shows rich structured data (tool calls, costs, messages, agent activity) — not terminal output. Interactive sessions keep the terminal; vigie captures their events via hooks. Between turns, users can review and steer.

### Ship Criteria

- Spawn a structured session via vigie and see tool calls + costs in the browser dashboard.
- Run Claude interactively in the terminal and vigie still shows structured events via hooks.
- Between turns of a structured session, the user can review results and send the next prompt.
- Kanban overview shows all sessions with status, cost, activity mode at a glance.

## Architecture Overview

**Approach: Foundation + Feature Tracks**

1. **Foundation phase**: Kysely migration, full domain model, all typed tables
2. **Structured channel track**: Claude SDK adapter → event persistence → event bus
3. **Hook channel track**: HTTP endpoint → event mapper → same persistence + bus
4. **Dashboard phase**: Full UI redesign against real data

**Dual-channel architecture** — both channels coexist:

```
Structured sessions:
  vigie → SDK query() → AsyncIterator<StructuredEvent> → persistence + event bus → browser

Interactive sessions:
  User terminal → Claude Code → hooks POST → vigie /api/hooks → mapper → same pipeline
  User terminal → Claude Code → PTY → vigie → xterm.js (escape hatch)
```

**Scope**: Claude-only adapters. The domain model is agent-agnostic by design (port/adapter pattern), but the only working adapters in M0 are for Claude.

---

## 1. Domain Model — SessionEvent Types

### New Structured Event Types

Added to `#shared/kernel/session/events.ts` alongside existing lifecycle events.

```typescript
// --- Structured Agent Events (M0) ---

TextDelta {
  type: 'agent:text-delta'
  sessionId, turnIndex, role ('assistant' | 'user'), content (string), timestamp
}

ToolCall {
  type: 'agent:tool-call'
  sessionId, turnIndex, toolName, toolCallId, input (Record<string, unknown>),
  status ('running' | 'completed' | 'error'), output? (string), error? (string),
  durationMs? (number), timestamp
}

CostUpdate {
  type: 'agent:cost-update'
  sessionId, turnIndex, inputTokens, outputTokens, cacheReadTokens?,
  cacheWriteTokens?, totalCostUsd (number), modelId (string), timestamp
}

SubagentSpawn {
  type: 'agent:subagent-spawn'
  sessionId, turnIndex, parentToolCallId, subagentSessionId,
  description (string), timestamp
}

TurnStarted {
  type: 'agent:turn-started'
  sessionId, turnIndex, prompt (string), mode ('auto' | 'manual'), timestamp
}

TurnCompleted {
  type: 'agent:turn-completed'
  sessionId, turnIndex, stopReason ('end_turn' | 'max_tokens' | 'pause' | 'error'),
  summary? (string), timestamp
}
```

### Session Model Evolution

New fields on the `Session` aggregate:

- `sessionType: 'structured' | 'interactive'` — determines which channel is primary
- `autoAdvance: boolean` — pause-by-default (false) or autonomous (true)
- `currentTurnIndex: number` — tracks turn progression
- `totalCostUsd: number` — running cost accumulator
- `agentSessionId?: string` — SDK session ID for `--continue` support

### Event Discriminated Union

```typescript
type StructuredEvent =
  | TextDelta | ToolCall | CostUpdate
  | SubagentSpawn | TurnStarted | TurnCompleted

type SessionEvent = SessionLifecycleEvent | TerminalEvent | StructuredEvent
```

Existing lifecycle events (`session:started`, `session:ended`, etc.) and terminal events (`terminal:input-echo`, `terminal:pty-resized`) remain unchanged.

### Valibot Schemas

All event types defined as Valibot schemas in `#shared/kernel/session/`. These schemas are the single source of truth — used by:
- Server: validate before emitting over WebSocket
- Client: validate on receipt in `ws-sync.ts`
- Hook receiver: validate incoming hook payloads before mapping

---

## 2. Persistence — Kysely Migration + Typed Tables

### Kysely Setup

- Add `kysely` dependency with Bun-compatible SQLite dialect
- Define a `Database` interface typing all tables
- File-based migration system in `src/shared/infrastructure/db/migrations/`
- Migrate existing tables (`sessions`, `terminal_chunks`, `input_history`) into Kysely management — schema unchanged, brought under typed control

### Sessions Table Evolution

Add columns to existing `sessions` table:

| Column | Type | Default | Notes |
|---|---|---|---|
| `session_type` | TEXT | 'interactive' | 'structured' \| 'interactive' |
| `auto_advance` | INTEGER | 0 | boolean |
| `current_turn_index` | INTEGER | 0 | |
| `total_cost_usd` | REAL | 0 | |
| `agent_session_id` | TEXT | null | SDK session ID |

### New Tables

**`turns`**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| session_id | TEXT FK | → sessions |
| turn_index | INTEGER | sequential per session |
| prompt | TEXT | user prompt for this turn |
| mode | TEXT | 'auto' \| 'manual' |
| stop_reason | TEXT | nullable, set on completion |
| summary | TEXT | nullable |
| started_at | TEXT | ISO timestamp |
| completed_at | TEXT | nullable |

**`text_deltas`**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| session_id | TEXT FK | → sessions |
| turn_index | INTEGER | |
| role | TEXT | 'assistant' \| 'user' |
| content | TEXT | delta text chunk |
| created_at | TEXT | ISO timestamp |

**`tool_calls`**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID or agent's toolCallId |
| session_id | TEXT FK | → sessions |
| turn_index | INTEGER | |
| tool_name | TEXT | |
| input | TEXT | JSON stringified |
| status | TEXT | 'running' \| 'completed' \| 'error' |
| output | TEXT | nullable |
| error | TEXT | nullable |
| duration_ms | INTEGER | nullable |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

**`cost_updates`**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| session_id | TEXT FK | → sessions |
| turn_index | INTEGER | |
| input_tokens | INTEGER | |
| output_tokens | INTEGER | |
| cache_read_tokens | INTEGER | nullable |
| cache_write_tokens | INTEGER | nullable |
| total_cost_usd | REAL | |
| model_id | TEXT | |
| created_at | TEXT | ISO timestamp |

**`subagent_spawns`**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| session_id | TEXT FK | → sessions |
| turn_index | INTEGER | |
| parent_tool_call_id | TEXT FK | → tool_calls |
| subagent_session_id | TEXT | |
| description | TEXT | |
| created_at | TEXT | ISO timestamp |

### Indexes

- `idx_turns_session` on `turns(session_id, turn_index)`
- `idx_tool_calls_session_turn` on `tool_calls(session_id, turn_index)`
- `idx_cost_updates_session` on `cost_updates(session_id)`
- `idx_text_deltas_session_turn` on `text_deltas(session_id, turn_index)`
- `idx_subagent_spawns_session` on `subagent_spawns(session_id)`

---

## 3. SDK Adapter — Structured Channel

### AgentRunner Port Evolution

The current `AgentRunnerShape` returns `Stream.Stream<AgentChunk>` (raw bytes). M0 evolves it:

```typescript
AgentRunnerShape {
  spawnInteractive(options) → Stream.Stream<AgentChunk>    // existing PTY path, renamed
  spawnStructured(options) → Stream.Stream<StructuredEvent> // new SDK path
}
```

The session's `sessionType` determines which method the `spawn-session` use case calls. Both return Effect Streams.

### Claude SDK Adapter

New file: `src/modules/agent-session/infrastructure/adapters/out/agents/claude-sdk.adapter.ts`

- Import `@anthropic-ai/claude-agent-sdk`
- Call `query()` with user prompt and session ID for continuity
- Map SDK response events → `StructuredEvent` types
- Multi-turn: use SDK session persistence between turns
- On `TurnCompleted` with `autoAdvance=false`: stream yields `TurnCompleted` and pauses. Use case waits for user input before next `query()`.

### Event Flow

```
User spawns structured session
  → spawn-session use case
    → claudeSdkAdapter.spawnStructured(prompt, sessionId)
      → SDK query() → async iterator of SDK events
        → mapper: SDK event → StructuredEvent
          → Stream.Stream<StructuredEvent>
            ├→ event-persistence use case → Kysely insert into typed tables
            ├→ SessionEventBus.publish() → WebSocket → browser
            └→ Session aggregate: update turnIndex, totalCostUsd
```

### Turn Management

```
Turn 1: user prompt → SDK query() → events stream → TurnCompleted
  → autoAdvance=false (default): pause, wait for user input via POST /api/sessions/:id/prompt
  → autoAdvance=true: SDK decides (end_turn = done, otherwise continue)

User sends next prompt: POST /api/sessions/:id/prompt
  → Turn 2: new prompt → SDK query() with --continue → events stream → ...
```

---

## 4. Hook Channel — Interactive Session Events

### Hook Receiver Endpoint

New route: `POST /api/hooks`

Receives Claude Code hook events fired from `settings.json` hook configuration.

### Event Mapping

| Hook event | → StructuredEvent |
|---|---|
| `tool_use` start | `ToolCall` (status: running) |
| `tool_use` result | `ToolCall` (status: completed/error) |
| `assistant_message` | `TextDelta` |
| `api_request` / cost metadata | `CostUpdate` |
| `subagent` spawn | `SubagentSpawn` |

Events that don't map to a known type are logged and dropped — no catch-all bucket.

### Session Association

- Sessions started via `vigie claude` — vigie passes session ID to Claude Code via environment variable or hook context
- External Claude sessions (user ran `claude` directly) — vigie matches by `cwd` + `agentSessionId` from hook payload. If no match, auto-creates a session (passive monitoring).

### Guided Hook Setup

First time `vigie daemon start` detects Claude Code (`~/.claude/` exists):

1. Prompt user: "vigie detected Claude Code. Want to enable structured event monitoring for interactive sessions?"
2. On confirm: write hook entries to `~/.claude/settings.json` targeting `POST http://localhost:19191/api/hooks`
3. Store flag in `~/.vigie/config.json` — don't prompt again
4. CLI commands: `vigie hooks status` / `vigie hooks install` / `vigie hooks uninstall`

Hook config targets vigie's daemon URL. If daemon isn't running, hooks silently fail (Claude Code doesn't block on hook failures).

---

## 5. Dashboard v2 — Full UI Redesign

### Layout Structure

Three zones replacing the current single-panel terminal view:

- **Top bar**: global stats — total active sessions, aggregate cost, daemon status
- **Main area**: switchable between Kanban Overview and Session Detail
- **Spawn dialog**: modal for creating new sessions

### Kanban Overview (Default Landing)

Columns by session status:

| Column | Contains |
|---|---|
| **Queued** | sessions created but not started |
| **Running** | active sessions (structured or interactive) |
| **Paused** | structured sessions awaiting user input |
| **Completed** | successfully finished |
| **Stopped** | groups `error`, `abandoned`, `killed` with sub-labels |
| **Archived** | hidden by default, toggle to show |

Each card shows:
- Session name / ID
- Agent type badge
- Session type indicator (structured / interactive)
- Activity mode badge (Planning / Implementing / Testing / Reviewing / Waiting / Other)
- Current turn index
- Running cost (USD)
- Last activity timestamp
- Active tool call name (if running)

**Card quick actions** (context menu or icon buttons):
- **Pause** — force-pause a running structured session
- **Resume** — resume a paused session
- **Kill** — terminate immediately
- **Abandon** — mark as intentionally stopped
- **Archive** — move to archived (completed/stopped sessions)
- **Delete** — permanently remove session + all events

### Session Status Model

```
queued → running → paused → running (resume)
                 → completed (agent finishes)
                 → error (agent crashes)
                 → abandoned (user gives up)
                 → killed (user force-stops)

completed/error/abandoned/killed → archived (user archives)
any non-running state → deleted (permanent)
```

### Session Detail View

**Structured session:**
- **Left panel — Turn timeline**: vertical list of turns, each expandable
  - Turn header: index, prompt preview, cost, duration
  - Expanded: full prompt, assistant messages, tool calls (nested), cost breakdown
- **Right panel — Live event feed**: real-time stream for current turn
  - Tool calls with status indicators (spinner → checkmark/error)
  - Text deltas streaming in
  - Subagent spawns as nested cards
- **Bottom bar — Prompt input**: send next prompt to paused session. Shows "auto-advancing..." if autonomous.

**Interactive session:**
- **Left panel — Structured event feed**: same layout, fed by hooks (may have gaps)
- **Right panel — xterm.js terminal**: live PTY stream, the escape hatch
- **Banner**: "Interactive session — structured events via hooks (best effort)"

### Activity Mode Indicator

Derived from recent tool calls, displayed on kanban cards and session detail header:

| Mode | Heuristic |
|---|---|
| **Planning** | Read, Grep, Glob, WebSearch tool calls |
| **Implementing** | Edit, Write, Bash (non-test) tool calls |
| **Testing** | Bash with test commands |
| **Reviewing** | Read after Edit sequences |
| **Waiting** | idle, awaiting user input |
| **Other** | unrecognized tool patterns — shows tool name or "Working" |

Computed from most recent tool calls in current turn. Stored on session as `activityMode`, updated in real-time.

### Session Spawn Form

- Agent type selector (Claude; extensible)
- Session type toggle: **Structured** (default) / **Interactive**
- Working directory picker
- Prompt input (structured) or mode selector (interactive)
- Auto-advance toggle (structured only, default off)

### Technology

- React SSR + Vite client islands (same stack)
- New islands: `KanbanBoard.island`, `SessionDetail.island`, `SpawnSession.island`
- nanostores for state (already migrated)
- `ws-sync.ts` extended for new event types
- CSS: Tailwind + `@vigie/tokens`

---

## 6. Frontend Architecture

### WebSocket Message Validation

All WebSocket message schemas defined in `#shared/kernel/session/` using Valibot:
- Server validates before emitting
- Client validates on receipt
- Single source of truth — no manual type guards in `ws-sync.ts`

### Frontend Structure

As the UI grows to kanban + detail views + event feeds, the frontend is restructured:

- **Colocate by feature**: group components, stores, and hooks by domain concern (kanban, session-detail, spawn-form) rather than by type
- **Typed store layer**: nanostores atoms validated with shared Valibot schemas. WebSocket messages parsed once through schema, then dispatched to relevant store.
- **Thin `ws-sync.ts`**: becomes a simple dispatcher — validate message → route to store update function. No business logic.
- **Extracted event mappers**: each event type has a small mapper function (validated event → store mutation). Testable in isolation.

---

## 7. API Surface

### REST Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/sessions` | Spawn session (extended: `sessionType`, `autoAdvance`) |
| POST | `/api/sessions/:id/prompt` | Send next prompt to paused structured session |
| POST | `/api/sessions/:id/pause` | Force-pause a running session |
| POST | `/api/sessions/:id/resume` | Resume a paused session |
| POST | `/api/sessions/:id/kill` | Kill a running session |
| POST | `/api/sessions/:id/abandon` | Mark session as abandoned |
| POST | `/api/sessions/:id/archive` | Archive a completed/stopped session |
| DELETE | `/api/sessions/:id` | Delete session + all events (existing) |
| GET | `/api/sessions/:id/events` | Structured events (paginated, filterable by type/turn) |
| GET | `/api/sessions/:id/turns` | Turn history |
| GET | `/api/sessions/:id/costs` | Cost breakdown |
| POST | `/api/hooks` | Receive Claude Code hook events |
| GET | `/api/hooks/status` | Hook installation status |
| POST | `/api/hooks/install` | Install hooks into Claude Code settings |
| POST | `/api/hooks/uninstall` | Remove hooks |

### WebSocket

| Path | Change |
|---|---|
| `/ws/events` | Extended: emits `StructuredEvent` types + activity mode changes |
| `/ws/terminal/:sessionId` | Unchanged — raw PTY for interactive sessions |

### CLI Commands

| Command | Purpose |
|---|---|
| `vigie hooks status` | Show hook config state |
| `vigie hooks install` | Manually install hooks |
| `vigie hooks uninstall` | Remove vigie hook entries |
