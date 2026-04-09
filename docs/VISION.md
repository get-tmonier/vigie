# vigie — project vision

> Last updated: 2026-04-09

## One-liner

**vigie is a professional SWE's workbench for the AI coding era.**

## The problem

AI coding tools (Claude Code, aider, codex, ...) are powerful but create massive cognitive overhead that has nothing to do with actual engineering work:

- **Model/quota juggling**: Which model for this task? How much weekly quota left? Should I wait until tonight for the expensive refactor?
- **Attention fragmentation**: 6 parallel sessions running — which one is stuck? Which needs input? Where did it write the plan file?
- **Context management**: When to clear context? Which session is near its limit? Did the agent lose track of the spec?
- **No structured visibility**: Tool calls, token costs, subagent trees — all buried in terminal scrollback
- **Worktree chaos**: Multiple worktrees from parallel agents — which has reviewable changes? How do I test this one?
- **Security blind spots**: What permissions did I grant? Is this agent modifying files outside scope?
- **Technique churn**: New MCPs, persistent memory patterns, hook workflows — keeping up is a job in itself
- **Daily SWE work unaugmented**: PR reviews, codebase exploration, pair programming — still done the old way despite having AI available

Every one of these has a solution *somewhere* — a CLI flag, a config file, a mental note, a browser tab. **But the engineer is the integration layer, and that's the problem.**

## The vision

vigie sits above your AI coding tools and handles the stuff that isn't your actual work. It doesn't replace Claude Code or aider — it makes using them professional-grade.

### Three engagement levels

vigie meets you where you are. You don't have to go all-in — start light, go deeper when it helps.

**Key design principle: the browser is the command center, the terminal is the workbench.** vigie's browser UI is purpose-built for structured data — session cards, event feeds, cost graphs, diff viewers. It does not try to be a terminal emulator. When you need to interact with an agent directly (type input, see raw TUI output), you use your actual terminal. Both views share the same session via session IDs and transcript files.

1. **Passive monitoring** (lightest touch): You run Claude Code normally in your terminal. vigie listens via hooks (`PostToolUse`, `SessionStart`, etc.) and collects structured events passively. Zero workflow change — vigie just shows you what's happening across sessions in the browser.

2. **Structured mode** (primary): vigie spawns and drives agents. Each turn is a `claude -p --continue --output-format stream-json` call (or via `@anthropic-ai/claude-agent-sdk`). Between turns, vigie is in control: shows results in the browser, lets you steer, checks guardrails, tracks costs. Turn-based by design — deliberate, not autopilot.

3. **Interactive mode** (escape hatch): Drop into any session with `claude --resume $id` in your terminal for full interactive TUI. vigie still receives structured events via hooks while you work interactively. Same session, switchable at any time.

### Core capabilities

#### 1. Operations layer — manage the machines

| Mental load today | vigie handles it |
|---|---|
| "Which model for this task?" | Smart defaults + quota-aware scheduling |
| "Is that session stuck/waiting?" | Attention signals — surfaces sessions that need you |
| "Where's the plan file?" | Structured data extraction, plans visible in UI |
| "How much have I burned this week?" | Token/cost tracking with quota awareness |
| "Let me check each terminal..." | Single dashboard, notifications for what matters |
| "Is Claude doing something weird?" | Guardrails, scope drift detection |
| "When should I run the big refactor?" | Rate limit awareness, time-of-day scheduling |

#### 2. Workbench — augment daily SWE work

| Traditional tool | vigie equivalent |
|---|---|
| GitHub PR review UI | AI-augmented code review with deep context |
| "grep + find + read" | Interactive codebase exploration |
| Screen sharing for pairing | Collaborative agent steering — shared plan editing, interactive approval |
| Terminal + tmux | Session management with structured data |
| Scattered configs | Opinionated, managed workflow defaults |

#### 3. Worktree-aware development

- See all active worktrees, what changed in each, which agent created them
- Review diffs in a proper UI, not `git diff` in a terminal
- Test from worktrees with one click
- Merge/discard with confidence

#### 4. Security and control

- Centralized permission management across agents
- Visibility into what tools agents are calling and on what files
- Scope boundaries — alert when an agent goes outside its designated area
- Audit trail of all agent actions

## Principles

1. **Local-first** — everything runs on localhost. No cloud, no accounts, no telemetry. Your code never leaves your machine.
2. **Agent-agnostic** — works with Claude Code, aider, codex, and whatever comes next. No vendor lock-in.
3. **Control, not automation** — vigie informs and guides, it doesn't take over. The SWE decides.
4. **Opinionated defaults, flexible escape hatches** — best practices baked in, but you can always drop down to raw tools.
5. **Reduce cognitive load** — if the engineer is thinking about vigie instead of their feature, vigie has failed.
6. **Built by a SWE, for SWEs** — not a management dashboard. Not a metrics platform. A tool for people who write code.

## Non-goals

- **Not a CI/CD tool** — vigie doesn't deploy your code
- **Not a project management tool** — no tickets, no sprints, no boards
- **Not a team management tool** — no "watch what your devs are doing"
- **Not a cloud service** — will never require an account or internet connection
- **Not an AI agent itself** — vigie orchestrates and observes, it doesn't write code

## Target user

A professional software engineer (freelance or team) who:
- Uses AI coding tools daily (not occasionally)
- Runs multiple parallel sessions
- Cares about code quality and security
- Wants efficiency without giving up control
- Is tired of being the integration layer for their own tools

## Architectural direction

### Agent-agnostic domain model

The domain speaks vigie's language, never agent-specific types. The UI and business logic only know `SessionEvent`:

```
SessionEvent = TextDelta | ToolCall | CostUpdate | SubagentSpawn | Error | TurnComplete
SessionStream = AsyncIterator<SessionEvent>
SessionTurn  = { prompt, events: SessionEvent[], cost, duration }
```

Each agent adapter translates its specific protocol into `SessionEvent`:

```
AgentRunner port (outbound)
├── claude-sdk.adapter     → @anthropic-ai/claude-agent-sdk → SessionEvent
├── opencode.adapter       → opencode's protocol → SessionEvent
├── aider.adapter          → aider output → SessionEvent
└── generic-pty.adapter    → raw PTY fallback (current behavior, least structured)
```

The richest adapter (Claude SDK) gives tool calls, costs, subagent trees. A bare PTY adapter gives only raw output. The domain handles both — features degrade gracefully based on what the adapter provides.

### Browser = command center, terminal = workbench

A core design principle: **the browser UI is purpose-built for structured data. It does not try to be a terminal emulator.** When you need to interact with an agent directly (type input, see raw TUI output, approve tool calls in the Claude Code UI), you use your actual terminal. Both views share the same session via session IDs and transcript files.

**Why this separation:**

The browser is where vigie adds value: session cards, event feeds, cost graphs, plan viewers, diff reviewers, attention signals. None of these need raw terminal output. Trying to embed a terminal in the browser (PTY → binary WebSocket → xterm.js) adds massive complexity for something the user already has: a terminal application.

The structured event channel (SDK, hooks, transcript JSONL) gives vigie everything it needs for the browser: what tools were called, how much it cost, which files changed, where subagents are. This is what powers the dashboard.

**How the two surfaces work together:**

```
┌──────────────────────────────┐    ┌─────────────────────────────────┐
│ Browser (structured)          │    │ Terminal (interactive)           │
│                               │    │                                 │
│ Session cards + status        │    │ claude                          │
│ Event feed (tool calls, msgs) │    │ claude --resume $id             │
│ Cost graphs                   │◄──►│                                 │
│ Plan viewer                   │    │ Full TUI: input, colors,        │
│ Diff reviewer                 │    │ progress bars, approvals        │
│ Attention signals             │    │                                 │
│                               │    │ You type here when needed       │
└──────────────────────────────┘    └─────────────────────────────────┘
        Same session ID — same transcript JSONL on disk
```

**How vigie gets structured data per session type:**

| Session type | Structured data source | Interactive where? |
|---|---|---|
| SDK-spawned (structured mode) | `query()` → `AsyncIterator<SessionEvent>` (real-time, richest) | `claude --resume $id` in terminal if needed |
| Interactive (user runs Claude normally) | Hooks → HTTP POST to vigie (real-time) + transcript JSONL | User's own terminal |
| External (not spawned by vigie) | Hooks → HTTP POST + transcript JSONL | User's own terminal |

**Data richness spectrum:**

```
Claude SDK adapter    → ToolCall, CostUpdate, SubagentSpawn, TextDelta (full structured)
Hooks + transcript    → ToolCall, CostUpdate, TextDelta (near-full, slightly delayed)
```

**Note on the existing PTY-to-browser infrastructure:** The current codebase includes a full PTY-to-browser pipeline (Bun PTY, binary WebSocket, xterm.js, chunk replay). This code is preserved but not the focus of new development. It may be re-activated later as an optional terminal drawer in the browser UI if the need arises (e.g. collaborative viewing, iPad access). For M0 and beyond, the browser UI is structured-data-only.

### Turn-based execution model

Structured sessions are turn-based: vigie sends a prompt, receives a stream of events until the turn completes, then decides what's next. Between turns vigie can:

- Show results (tool calls, code changes, costs)
- Let the user steer, redirect, or stop
- Check guardrails before the next turn
- Update quota tracking
- Surface the session for code review

This is deliberate. Continuous autopilot is a non-goal. The SWE stays in the loop.

Sessions are interchangeable between modes: start via SDK (`query()`), resume interactively (`claude --resume $id`), or vice versa. Same session files on disk.

### From terminal mirror to structured workbench

The evolution from v0.x to v1:

1. **Domain event model** — `SessionEvent` types as the lingua franca between agents, storage, and UI
2. **Agent adapters** — one per agent type, translating native protocols into domain events
3. **Hooks integration** — receive structured events from interactive sessions via Claude Code hooks (HTTP POST to vigie daemon)
4. **Product UI** — session cards, event feed, cost graphs, plan viewer, diff reviewer. Structured data only — no terminal embedding
5. **Quota/scheduling engine** — track rate limits per model, suggest when to run expensive tasks
6. **Worktree awareness** — detect worktrees, show diffs, enable review and testing workflows

### Key technical decisions ahead

- Frontend framework for the product UI (keep React SSR + islands? or move to something richer?)
- Event storage schema (structured events in SQLite — terminal chunks table kept but no longer primary)
- Hook receiver endpoint design (HTTP endpoint in vigie daemon for hook POST events)
- Worktree integration approach (git commands? libgit2? Bun native?)
- Rate limit data source (parse from API responses? user-configured quotas?)

## What exists today (v0.x — exploration phase)

- Hexagonal architecture with Effect, clean domain model
- PTY-based agent spawning and terminal streaming (parked — preserved in codebase, not the focus going forward)
- SQLite persistence for sessions and terminal output
- React SSR with Vite client islands
- CLI with daemon management
- WebSocket real-time updates
- Multi-agent support (Claude, aider, codex adapters)

This foundation is solid. The domain model, ports/adapters pattern, and Effect infrastructure carry forward. The PTY pipeline stays in the codebase as a potential future feature (browser terminal drawer) but new development focuses on the structured event layer.
