# vigie roadmap v2

> Product-driven roadmap. Replaces the previous infrastructure-focused roadmap.
> Each milestone is a usable version. Ship early, iterate.
> Last updated: 2026-04-10

## Milestones

### M0 — Structured foundation (use it yourself)

**Goal:** Add a structured event layer. The browser dashboard shows structured data (tool calls, costs, messages) — not terminal output. Interactive sessions happen in your terminal; vigie gets their events via hooks.

**Architecture:**
- `SessionEvent` domain types as the agent-agnostic lingua franca
- `AgentRunner` port returns `AsyncIterator<SessionEvent>`
- Claude SDK adapter: richest data via `@anthropic-ai/claude-agent-sdk` `query()`
- Hook receiver: HTTP endpoint receives events from interactive Claude Code sessions
- Sessions resumable and switchable between SDK and interactive via `--continue` / `--resume`
- Existing PTY-to-browser code parked (preserved, not used in M0 dashboard)

| Item | Description | Status |
|---|---|---|
| SessionEvent domain model | `TextDelta \| ToolCall \| CostUpdate \| SubagentSpawn \| Error \| TurnComplete` types in the domain layer | `[ ]` |
| AgentRunner port evolution | Evolve current port from "spawn a process" to "spawn + return `AsyncIterator<SessionEvent>`" | `[ ]` |
| Claude SDK adapter | Implement `AgentRunner` using `@anthropic-ai/claude-agent-sdk` `query()`, mapping `SDKMessage` → `SessionEvent` | `[ ]` |
| Hook receiver endpoint | HTTP endpoint in vigie daemon (`POST /api/hooks`) that receives Claude Code hook events (`PostToolUse`, `SubagentStop`, etc.) and converts them to `SessionEvent`s — enables visibility into interactive terminal sessions | `[ ]` |
| Hook auto-configuration | vigie generates/manages Claude Code `settings.json` hook entries pointing to vigie's hook receiver | `[ ]` |
| Turn management | Session tracks turns for structured mode, supports `--continue` / `--resume`, stores turn history | `[ ]` |
| Event persistence | Store `SessionEvent`s in SQLite (new tables alongside existing ones) | `[ ]` |
| Dashboard v2 — session cards | Session cards showing: status, agent type, token count, last activity, whether session is interactive or structured | `[ ]` |
| Dashboard v2 — event feed | Per-session structured event feed: tool calls, messages, costs — scrollable, filterable | `[ ]` |
| SQL type safety (Kysely) | Needed before schema changes for new event storage. Carried from previous roadmap R-002 | `[ ]` |
| DB migrations | Needed for new tables (structured events, cost tracking). Carried from R-003 | `[ ]` |

**Ship when:** You can spawn a structured session via vigie and see tool calls + costs in the browser. You can run Claude interactively in your terminal and vigie still shows structured events in the browser via hooks. Between structured turns, you can review and steer.

---

### M1 — Attention and awareness (stop checking terminals)

**Goal:** vigie tells you what needs your attention instead of you checking every session.

| Item | Description | Status |
|---|---|---|
| Attention signals | Classify session states: needs-input, stuck (no progress for N seconds), completed, errored, high-burn-rate | `[ ]` |
| Plan extraction | Detect when an agent writes a plan/todo, extract and display it in the UI | `[ ]` |
| Notification system | Browser notifications (or desktop via Bun native) for attention-worthy events | `[ ]` |
| Session timeline | Visual timeline per session: what happened when, how long each tool call took | `[ ]` |
| Subagent tree view | Visualize parent/child agent relationships, track which subagent is doing what | `[ ]` |
| Context window indicator | Show how full each session's context is, warn when approaching limits | `[ ]` |

**Ship when:** You can work on something else and vigie tells you when a session needs you.

---

### M2 — Quota and scheduling (stop counting tokens)

**Goal:** vigie manages your rate limits and helps you plan when to run what.

| Item | Description | Status |
|---|---|---|
| Cost dashboard | Aggregate view: tokens/cost per session, per day, per week, per model | `[ ]` |
| Quota tracking | Configure weekly/daily quotas per model. vigie tracks usage against them | `[ ]` |
| Smart scheduling | "This task is estimated expensive — suggest running after 8pm when quota resets" | `[ ]` |
| Model recommendation | Based on task complexity, suggest appropriate model (don't use Opus for a rename) | `[ ]` |
| Usage history | Historical charts: where are your tokens going? Which types of tasks cost most? | `[ ]` |

**Ship when:** You know exactly how much quota you have left and vigie helps you use it wisely.

---

### M3 — Code review and worktree management (stop juggling git)

**Goal:** Review agent-produced code and manage worktrees without leaving vigie.

| Item | Description | Status |
|---|---|---|
| Worktree awareness | Detect all git worktrees, show which session created each, what changed | `[ ]` |
| Diff viewer | Side-by-side diff view for worktree changes, file-by-file navigation | `[ ]` |
| AI-augmented review | Ask questions about specific changes: "why did the agent change this?", "is this safe?" | `[ ]` |
| PR preparation | From a worktree: generate PR title/description, preview, create via `gh` | `[ ]` |
| Incoming PR review | Load a PR from GitHub, get AI-assisted review with codebase context | `[ ]` |
| Worktree actions | Merge, discard, test (run a command in the worktree context) from the UI | `[ ]` |

**Ship when:** You can review and merge agent work from vigie's UI without touching the terminal.

---

### M4 — Security and guardrails (stop worrying)

**Goal:** Know what your agents are doing and set boundaries.

| Item | Description | Status |
|---|---|---|
| Scope boundaries | Define allowed file paths / directories per session. Alert on out-of-scope modifications | `[ ]` |
| Permission dashboard | See what tools each session has used, what files it has modified | `[ ]` |
| Dangerous action alerts | Flag destructive operations: `rm -rf`, force push, dropping tables, etc. | `[ ]` |
| Session audit trail | Searchable log of every action an agent took, with timestamps | `[ ]` |
| Claude Code settings manager | Manage `settings.json` permissions, allowed tools, etc. from vigie UI | `[ ]` |

**Ship when:** You can see exactly what an agent did and set boundaries for what it can do.

---

### M5 — Collaborative pairing (reinvent pair programming)

**Goal:** Pair programming for the AI era — not watching someone type a prompt.

| Item | Description | Status |
|---|---|---|
| Shared session view | Multiple people can watch the same session's structured feed | `[ ]` |
| Interactive plan editing | See the agent's plan, approve/reject/modify steps before execution | `[ ]` |
| Annotation layer | Comment on specific tool calls or code changes in the feed | `[ ]` |
| Steering controls | Pause, redirect, or constrain an agent mid-session | `[ ]` |
| Session handoff | Transfer a session's context to another person or another agent | `[ ]` |

**Ship when:** Two people can meaningfully collaborate on an agent-driven task.

---

### M6 — Codebase intelligence (stop grepping)

**Goal:** Understand any codebase interactively, not through terminal commands.

| Item | Description | Status |
|---|---|---|
| Interactive codebase map | Visual overview of a repo: modules, dependencies, entry points | `[ ]` |
| Semantic search | Search by concept, not just text: "where is authentication handled?" | `[ ]` |
| Codebase audit mode | Point vigie at a repo, get a structured assessment: architecture, patterns, risks | `[ ]` |
| Onboarding flow | New to a repo? Guided exploration with AI context | `[ ]` |

**Ship when:** You can understand a new codebase faster through vigie than through terminal exploration.

---

## Infrastructure (pulled in as needed)

These items from the previous roadmap are prerequisites for specific milestones:

| Item | Needed for | Previous ID |
|---|---|---|
| SQL type safety (Kysely) | M0 — new event storage | R-002 |
| DB migrations | M0 — schema changes | R-003 |
| API type safety (shared contracts) | M0 — new dashboard API calls | R-004 |
| Effect.Scope for PTY/sockets | M0 — dual-mode cleanup | R-005 |
| Structured logging | M1 — attention signals need logs | R-006 |
| Binary build pipeline | Post-M0 — distribution | D-001 |
| Auto-update | Post-M0 — distribution | F-001 |
| WebSocket reconnection | M0 — dashboard reliability | F-003 |

## What's deferred

These are valuable but not on the critical path:

- Unify on Effect.Schema (drop Valibot) — do if/when it helps, not as a goal
- E2E tests (Playwright) — after the UI stabilizes post-M0
- Mobile/responsive layout — after the UI exists
- Homebrew tap / npm global install — after binary pipeline
- Accessibility basics — fold into each milestone as UI is built

## Sequencing rationale

**M0 first** because everything else depends on having structured data. Without it, attention signals, cost tracking, and guardrails are impossible.

**M1-M2 next** because they address the biggest daily pain: "where should my attention be?" and "am I burning quota?"

**M3 before M4** because code review happens every day; security guardrails are important but less frequent.

**M5-M6 are ambitious** and may shift based on what you actually need as a freelance SWE. They're the vision, not the commitment.
