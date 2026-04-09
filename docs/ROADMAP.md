# vigie roadmap

> Living tracker from full codebase audit. Update status as work progresses.
> Last reviewed: 2026-04-09

---

## How to use this file

- Update **Status** when starting or completing an item
- Add **Completed date** and **PR/commit** reference when done
- Move items between priorities if the situation changes
- Add new items at the bottom of the relevant section

### Statuses

| Icon | Meaning |
|------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |
| `[-]` | Dropped / won't do |

### Priorities

| Priority | Meaning |
|----------|---------|
| P0 | Do before first public release |
| P1 | Do soon — real architectural debt |
| P2 | Do when touching the area |
| P3 | Nice to have |

---

## At a glance

> Quick scan of everything. Details in sections below.

### P0 — Ship-blocking
- [ ] Refactor: [Island architecture — break the mega-island](#r-001)
- [ ] Refactor: [SQL type safety with Kysely](#r-002)
- [ ] Feature: [Auto-update (`vigie update`)](#f-001)
- [ ] Distribution: [Binary build pipeline](#d-001)
- [ ] Testing: [Infrastructure adapter tests](#t-001)

### P1 — Architectural debt
- [ ] Refactor: [Database migrations](#r-003)
- [ ] Refactor: [Frontend API type safety (shared contracts)](#r-004)
- [ ] Refactor: [Effect.Scope for PTY and Unix sockets](#r-005)
- [ ] Testing: [CLI command smoke tests](#t-002)
- [ ] Testing: [Code coverage tooling](#t-003)
- [ ] Docs: [API reference](#doc-001)

### P2 — Quality of life
- [ ] Refactor: [Structured logging](#r-006)
- [ ] Refactor: [Unify on Effect.Schema (drop Valibot)](#r-007)
- [ ] Feature: [React error boundaries](#f-002)
- [ ] Feature: [WebSocket reconnection hardening](#f-003)
- [ ] Feature: [Error tracking and observability](#f-004)
- [ ] Testing: [API contract tests](#t-004)
- [ ] Docs: [Sequence diagrams for complex flows](#doc-002)
- [ ] Distribution: [Homebrew tap](#d-002)

### P3 — Polish
- [ ] Feature: [Mobile / responsive layout](#f-005)
- [ ] Feature: [Frontend loading and error states](#f-006)
- [ ] Feature: [Accessibility basics](#f-007)
- [ ] Testing: [E2E tests](#t-005)
- [ ] Docs: [Developer onboarding guide](#doc-003)
- [ ] Distribution: [npm global install fallback](#d-003)

---

## Refactoring

<a id="r-001"></a>
### `[x]` P0 — Island architecture: break the mega-island

| | |
|---|---|
| Status | Done (2026-04-09) |
| Depends on | — |
| Blocks | — |
| PR | [#33](https://github.com/tmonier/vigie/pull/33) |

**Problem:** `SessionDashboard.island.tsx` wraps the entire page. Every component (header, sidebar, session list, form, terminal) hydrates as one React blob. The "island" suffix is cosmetic — this is full SPA hydration. SSR renders HTML that the client immediately throws away and re-renders.

**Goal:** Only hydrate interactive parts. Static layout, header, branding = zero JS.

**Proposed islands:**

| Island | Interactivity |
|--------|--------------|
| `SessionList.island.tsx` | Click to select, WS event updates |
| `SpawnSessionForm.island.tsx` | Form input + submit (already exists, needs standalone mount) |
| `SessionDetail.island.tsx` | Action buttons + terminal embed |
| `InteractiveTerminal.island.tsx` | Full xterm.js I/O (already standalone) |
| Header, layout, sidebar chrome | Pure SSR — no JS |

**Cross-island state:** Replace Redux with either:
- `nanostores` (~1KB, framework-agnostic, Astro-recommended pattern)
- `CustomEvent` on `window` (zero deps, simplest)
- URL as source of truth (`?session=<id>`, already partially implemented)

**Outcome:** Drop `@reduxjs/toolkit` + `react-redux` dependencies. Halve client JS bundle. Faster page loads.

---

<a id="r-002"></a>
### `[ ]` P0 — SQL type safety with Kysely

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | [R-003 Database migrations](#r-003) |

**Problem:** All SQLite queries are raw strings with manual type assertions (`db.query(sql).get(id) as SessionRow`). No compile-time column safety, no autocomplete, no refactoring support.

**Goal:** Typed queries, typed results, column-level inference.

**Plan:**
1. Add `kysely` + `kysely-bun-sqlite` dependencies
2. Define `Database` interface in `shared/db/schema.ts` mirroring tables (`sessions`, `terminal_chunks`, `input_history`, `event_queue`)
3. Refactor `sqlite-session-repository.ts` and `sqlite-terminal-repository.ts` to use Kysely query builder
4. Remove all raw SQL strings and `as` casts from repository adapters

**Outcome:** Compile-time SQL safety. Schema changes caught by TypeScript before runtime.

---

<a id="r-003"></a>
### `[ ]` P1 — Database migrations

| | |
|---|---|
| Status | Not started |
| Depends on | [R-002 Kysely](#r-002) |
| Blocks | — |

**Problem:** Schema is created inline in `database.ts` via `CREATE TABLE IF NOT EXISTS`. No versioning, no migration history. First schema change will require manual user intervention or data loss.

**Goal:** Numbered migrations that run automatically on daemon start.

**Plan:**
1. Use Kysely's built-in migrator (`FileMigrationProvider` with numbered SQL/TS files)
2. Move current `CREATE TABLE` statements into `migration-001-initial.ts`
3. Add migration runner to daemon startup (before `runDaemon`)
4. Store migration state in a `_migrations` table (Kysely handles this)

**Outcome:** Schema evolves safely. Users upgrading vigie get automatic DB migrations.

---

<a id="r-004"></a>
### `[ ]` P1 — Frontend API type safety (shared contracts)

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | [T-004 API contract tests](#t-004) |

**Problem:** Frontend hardcodes URLs (`fetch('/api/sessions')`) with no shared types. Response types are unvalidated. Server and client can drift silently.

**Goal:** Single source of truth for API contracts, shared between server routes and client calls.

**Plan:**
1. Create `shared/kernel/api-contract.ts` — request/response Valibot schemas per endpoint, path, method
2. Create `shared/lib/api-client.ts` — thin typed wrapper (~30 lines) around `fetch` that takes a contract and returns `v.InferOutput<ResponseSchema>`
3. Centralize WebSocket URLs and message schemas in the contract
4. Server routes validate against the same schemas
5. Refactor all `fetch()` calls in islands to use the typed client

**Outcome:** Contract drift caught at compile time. Autocomplete on API responses.

---

<a id="r-005"></a>
### `[ ]` P1 — Effect.Scope for PTY and Unix sockets

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** PTY handles and Unix sockets use manual `Map.delete()` cleanup. If the daemon crashes before finalizers are set up, these resources leak (orphaned socket files, zombie PTY processes).

**Goal:** Guaranteed cleanup via Effect's resource management.

**Plan:**
1. Wrap PTY spawn in `Effect.acquireRelease` — acquire spawns, release kills + removes from map
2. Wrap Unix socket `Bun.listen()` in `Effect.acquireRelease` — release closes + deletes socket file
3. Wrap stdin socket similarly
4. All resources tied to the daemon's `Scope` — automatic cleanup on shutdown or crash

**Outcome:** No resource leaks. Clean shutdown guaranteed by Effect runtime.

---

<a id="r-006"></a>
### `[ ]` P2 — Structured logging

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | [F-004 Error tracking](#f-004) |

**Problem:** Uses `Effect.log` / `Effect.logWarning` with plain strings. No log levels, no structured fields, no configurable log sink.

**Goal:** Structured JSON logs with levels, timestamps, context fields.

**Plan:**
1. Configure Effect's `Logger` layer with structured output (Effect has built-in `Logger.json`)
2. Add context fields: `sessionId`, `agentType`, `component` to log calls
3. Add `VIGIE_LOG_LEVEL` env var (default: `info`, `debug` for development)
4. Route logs to `~/.vigie/daemon.log` in background mode, stdout in foreground

**Outcome:** Debuggable daemon without attaching a debugger. Greppable structured logs.

---

<a id="r-007"></a>
### `[ ]` P2 — Unify on Effect.Schema (drop Valibot)

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** Valibot for protocol validation, Effect.Schema used once (JSON encoding). Two validation libraries for the same purpose.

**Goal:** Single validation/schema library across the codebase.

**Plan:**
1. Migrate IPC and browser protocol schemas from Valibot to Effect.Schema
2. Migrate API contract schemas to Effect.Schema
3. Use `Schema.decodeUnknown` in adapters instead of `v.safeParse`
4. Remove `valibot` dependency

**Outcome:** One schema library. Tighter integration with Effect error channel and encoding/decoding.

**Note:** Lower priority — Valibot works fine. Only do this if you want full Effect ecosystem alignment.

---

## Features

<a id="f-001"></a>
### `[ ]` P0 — Auto-update (`vigie update`)

| | |
|---|---|
| Status | Not started |
| Depends on | [D-001 Binary build pipeline](#d-001) |
| Blocks | — |

**Problem:** No update mechanism. Early adopters must manually download new binaries.

**Goal:** One-command update with version check notification.

**Plan:**
1. `shared/lib/version.ts` — exports `VIGIE_VERSION` from `package.json`
2. `check-update.ts` — async GET to `https://vigie.tmonier.com/version.json` (or GitHub Releases API), compares versions. Non-blocking, fire-and-forget via `Effect.forkDetach` on daemon start
3. `update.command.ts` — new CLI command: downloads latest binary for platform from GitHub Releases, replaces current binary, prints changelog
4. Startup notification: `vigie v0.4.0 available (current: v0.3.0) — run 'vigie update'`
5. GitHub Release assets named by platform: `vigie-darwin-arm64`, `vigie-darwin-x64`, `vigie-linux-x64`

**Outcome:** Early adopters always on latest. Frictionless upgrade path.

---

<a id="f-002"></a>
### `[ ]` P2 — React error boundaries

| | |
|---|---|
| Status | Not started |
| Depends on | [R-001 Island refactor](#r-001) |
| Blocks | — |

**Problem:** A React crash in any island takes down the entire dashboard. No graceful degradation.

**Goal:** Isolate failures per island.

**Plan:**
1. Create `shared/ui/ErrorBoundary.tsx` — catches React errors, shows fallback UI
2. Wrap each island mount point in an error boundary
3. Log errors to daemon (POST to a `/api/errors` endpoint or just console)

**Outcome:** Terminal crash doesn't kill session list. Partial functionality preserved.

---

<a id="f-003"></a>
### `[ ]` P2 — WebSocket reconnection hardening

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** WebSocket reconnect to `/ws/events` uses a fixed 2s interval. No exponential backoff, no max retries, no UI indication of connection state. If the daemon restarts, the dashboard silently drops events until reconnection succeeds.

**Goal:** Robust reconnection with user-visible connection state.

**Plan:**
1. Implement exponential backoff with jitter (1s -> 2s -> 4s -> 8s, cap at 30s)
2. Add max retry count (e.g., 20 attempts before giving up)
3. Show connection status indicator in the dashboard header (connected / reconnecting / disconnected)
4. On reconnect success, fetch full session snapshot to resync state
5. Apply same pattern to `/ws/terminal/:sessionId`

**Outcome:** Daemon restarts don't require a manual browser refresh. Users know when the dashboard is stale.

---

<a id="f-004"></a>
### `[ ]` P2 — Error tracking and observability

| | |
|---|---|
| Status | Not started |
| Depends on | [R-006 Structured logging](#r-006) |
| Blocks | — |

**Problem:** No crash reporting, no metrics, no traces. The only observability is `/api/health` returning a pid. If the daemon crashes or misbehaves, there's no record of what happened.

**Goal:** Lightweight observability suitable for a local-first tool.

**Plan:**
1. Structured error logging to `~/.vigie/daemon.log` (pairs with structured logging refactor)
2. Crash handler in `daemon.ts` — on `uncaughtException`/`unhandledRejection`, write stack trace to `~/.vigie/crash.log` with timestamp and version
3. `vigie daemon logs` command to tail the log file
4. Optional: basic metrics (sessions spawned, active count, uptime) exposed at `/api/metrics` for debugging
5. Consider Sentry integration behind a flag for users who opt in (not default — local-first philosophy)

**Outcome:** Crashes leave a trail. Users can file bug reports with `vigie daemon logs` output.

---

<a id="f-005"></a>
### `[ ]` P3 — Mobile / responsive layout

| | |
|---|---|
| Status | Not started |
| Depends on | [R-001 Island refactor](#r-001) |
| Blocks | — |

**Problem:** Dashboard assumes desktop. Sidebar layout breaks on small screens. Fine for a dev tool today, but limits usage on tablets or small laptop windows.

**Goal:** Usable at narrow viewport widths.

**Plan:**
1. Collapsible sidebar (hamburger menu or toggle) below a breakpoint (e.g., `md:`)
2. Stack sidebar above main content on small screens
3. Terminal scales via existing resize observer (already works)

**Outcome:** Dashboard usable at any window size without horizontal scroll.

---

<a id="f-006"></a>
### `[ ]` P3 — Frontend loading and error states

| | |
|---|---|
| Status | Not started |
| Depends on | [R-004 API contracts](#r-004) |
| Blocks | — |

**Problem:** API calls in islands don't show loading indicators or error feedback. Fetch failures are silent.

**Goal:** Visual feedback for all async operations.

**Plan:**
1. Add loading/error state to API client (or per-island hooks)
2. Show skeleton loaders while session list loads
3. Show toast/banner on API errors (spawn failed, kill failed, etc.)
4. Show connection status indicator for WebSocket (connected/reconnecting/disconnected)

---

<a id="f-007"></a>
### `[ ]` P3 — Accessibility basics

| | |
|---|---|
| Status | Not started |
| Depends on | [R-001 Island refactor](#r-001) |
| Blocks | — |

**Problem:** No ARIA attributes, no keyboard navigation.

**Goal:** Keyboard-navigable session list, screen reader support.

**Plan:**
1. Add `role`, `aria-label`, `aria-selected` to session list items
2. Arrow key navigation for session list
3. Focus management when selecting a session
4. Semantic HTML (`<nav>`, `<main>`, `<aside>`) in layout

---

## Testing

<a id="t-001"></a>
### `[ ]` P0 — Infrastructure adapter tests

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** 18% adapter coverage in agent-session, 15% in shell. Inner hexagon is solid; outer hexagon is untested.

**Priority targets (ordered by risk):**

1. **SQLite repositories** — `sqlite-session-repository`, `sqlite-terminal-repository`
   - Integration tests with `:memory:` SQLite
   - Cover CRUD, edge cases (duplicate IDs, missing records, pruning)

2. **PTY manager** — spawn, kill, resize, multi-browser channel routing
   - Unit tests with mock PTY handle
   - Verify callback wiring (onOutput, onProcessExited)

3. **Unix socket IPC** — server + client round-trip
   - Integration test: start server, connect client, send/receive messages
   - Verify protocol schema validation (malformed messages rejected)

4. **WebSocket terminal streaming** — connect, receive chunks, send input
   - Integration test with mock PTY + real HTTP server

5. **Event bus adapters** — SessionEventBus -> BrowserEventBus bridge
   - Unit tests verifying event transformation and fanout

---

<a id="t-002"></a>
### `[ ]` P1 — CLI command smoke tests

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** 0/8 CLI commands have tests.

**Plan:**
1. Test `vigie daemon status` when daemon is not running (expect error message)
2. Test `vigie session list` against a running daemon (expect JSON output)
3. Test command parsing (invalid flags, missing args)

---

<a id="t-003"></a>
### `[ ]` P1 — Code coverage tooling

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** No way to measure or enforce coverage thresholds.

**Plan:**
1. Add `bun test --coverage` to CI pipeline
2. Set initial threshold at current level (~15%) to prevent regressions
3. Ratchet up as tests are added

---

<a id="t-004"></a>
### `[ ]` P2 — API contract tests

| | |
|---|---|
| Status | Not started |
| Depends on | [R-004 API contracts](#r-004) |
| Blocks | — |

**Problem:** No tests that verify server routes match the expected request/response schemas.

**Plan:**
1. After shared contracts exist, write tests that hit each route and validate response against the contract schema
2. Cover error responses too (404, 409, 400)

---

<a id="t-005"></a>
### `[ ]` P3 — E2E tests

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** No browser-level tests.

**Plan:**
1. Add Playwright
2. Small suite: dashboard loads, session list renders, spawn session, kill session
3. Run in CI against a real daemon instance

---

## Documentation

<a id="doc-001"></a>
### `[ ]` P1 — API reference

| | |
|---|---|
| Status | Not started |
| Depends on | [R-004 API contracts](#r-004) |
| Blocks | — |

**Problem:** No documentation for the HTTP/WS API beyond code comments.

**Plan:**
1. Once shared contracts exist, auto-generate an API reference from the schemas
2. Or maintain a simple `docs/api.md` with endpoints, methods, request/response shapes

---

<a id="doc-002"></a>
### `[ ]` P2 — Sequence diagrams for complex flows

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** Session lifecycle, terminal I/O multiplexing, and IPC protocol are hard to understand without reading the code.

**Plan:**
1. Add Mermaid sequence diagrams to `docs/architecture/`
2. Cover: session spawn flow, terminal I/O multiplexing, daemon start/stop, IPC round-trip

---

<a id="doc-003"></a>
### `[ ]` P3 — Developer onboarding guide

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Problem:** New contributors must read CLAUDE.md + ADRs + source to understand the project.

**Plan:**
1. Add `docs/contributing.md` with setup instructions, architecture overview, and "where to look" guide
2. Link from root README

---

## Distribution

<a id="d-001"></a>
### `[ ]` P0 — Binary build pipeline

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | [F-001 Auto-update](#f-001) |

**Problem:** No CI pipeline for producing platform binaries.

**Plan:**
1. GitHub Actions workflow: `bun build --compile` for each platform target
2. Produce: `vigie-darwin-arm64`, `vigie-darwin-x64`, `vigie-linux-x64`
3. Upload as GitHub Release assets on tag push
4. Prerequisite for the auto-update feature

---

<a id="d-002"></a>
### `[ ]` P2 — Homebrew tap

| | |
|---|---|
| Status | Not started |
| Depends on | [D-001 Binary pipeline](#d-001) |
| Blocks | — |

**Problem:** macOS users expect `brew install`.

**Plan:**
1. Create `tmonier/homebrew-tap` repo
2. Formula downloads binary from GitHub Releases
3. `brew install tmonier/tap/vigie`

---

<a id="d-003"></a>
### `[ ]` P3 — npm global install fallback

| | |
|---|---|
| Status | Not started |
| Depends on | — |
| Blocks | — |

**Plan:**
1. Publish `@vigie/cli` to npm with `bin` field
2. `bunx @vigie/cli` or `npx @vigie/cli` as alternative install path
3. Lower priority since it requires Bun/Node globally

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-09 | ✅ R-001 (Island architecture) completed — 3 focused islands, nanostores, Redux removed |
| 2026-04-09 | Initial roadmap from full codebase audit (31 items) |
