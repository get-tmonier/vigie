# Event boundary cleanup

**Date:** 2026-04-08
**Branch:** `fix/server-not-starting`
**Status:** Draft

## Problem

Two event services in `agent-session` are ambiguous in naming and misplaced in boundary:

- **EventPublisher** — domain event bus used by all use cases. Name is generic.
- **EventFeed** — subscribes to EventPublisher, maps `DomainEvent` to `BrowserEvent`, broadcasts to WebSocket clients. Lives in `agent-session/application/ports/` despite being a browser presentation concern. The `BrowserEvent` type includes non-domain payloads (`daemon:hello`, `daemon:sync`, `pong`, `fs:list-dir-response`).

Additionally, `shared/kernel/` contains contracts that no longer justify a shared location now that there is only one domain module.

## Decision

Move presentation/delivery adapters out of `agent-session` into `shell`. Eliminate `shared/kernel/`. Rename services for clarity.

## Structural moves

### From `agent-session` to `shell`

| File | From | To |
|---|---|---|
| `event-feed.port.ts` | `agent-session/application/ports/out/` | `shell/application/ports/out/` |
| `event-feed.adapter.ts` | `agent-session/infrastructure/adapters/out/` | `shell/infrastructure/adapters/out/` |
| `event-feed.adapter.unit.test.ts` | `agent-session/.../out/__tests__/` | `shell/.../out/__tests__/` |
| `/ws/events` handler | extracted from `session.routes.tsx` | `shell/infrastructure/adapters/in/events.routes.ts` (new file) |
| `terminal.routes.ts` | `agent-session/infrastructure/adapters/in/` | `shell/infrastructure/adapters/in/` |
| `session.dto.ts` | `agent-session/infrastructure/adapters/in/` | `shell/infrastructure/adapters/in/` |
| `session.mapper.ts` | `agent-session/infrastructure/adapters/in/` | `shell/infrastructure/adapters/in/` |
| `dashboard.view.tsx` | `agent-session/infrastructure/adapters/in/` | `shell/infrastructure/adapters/in/` |
| UI islands (8 files) | `agent-session/infrastructure/adapters/in/ui/` | `shell/infrastructure/adapters/in/ui/` |
| `session.routes.integration.test.ts` | `agent-session/.../in/__tests__/` | `shell/.../in/__tests__/` |

### From `shared/kernel` to their proper homes

| File | From | To | Reason |
|---|---|---|---|
| `ipc-protocol.ts` | `shared/kernel/contracts/` | `shell/` (infrastructure or contracts subfolder) | Only shell imports it |
| `cli-sender.ts` | `shared/kernel/contracts/` | `agent-session/application/ports/out/session-sink.port.ts` | Standard outbound port; shell provides implementation |
| `errors.ts` (`AgentRunnerError`) | `shared/kernel/` | Define directly in `agent-session/domain/errors.ts` | Already re-exported from there; shell can import from agent-session |

### Delete

- `shared/kernel/` directory (empty after moves)
- `shared/kernel/CLAUDE.md`

## What stays in agent-session

- **DomainEventBus** (renamed from EventPublisher) — port, adapter, tests
- **REST/form routes** in `session.routes.tsx` (`GET /api/sessions`, `POST /api/sessions`, `POST /sessions/create`, `DELETE /api/sessions/:id`, etc.) — standard hexagonal inbound adapters that call use cases directly, no EventFeed dependency
- All use cases, domain entities, domain events, `SessionId`
- All `out/` adapters: SQLite repos, Bun PTY spawner, agent registry, terminal subscribers, FS resumability checker
- `SessionSink` port (renamed from CliSender) — agent-session defines the port, shell provides the implementation

## Renames

| Current | New | Scope |
|---|---|---|
| `EventPublisher` / `EventPublisherShape` | `DomainEventBus` / `DomainEventBusShape` | Port, adapter, all use case deps, all test helpers |
| `EventPublisherLive` | `DomainEventBusLive` | Adapter layer name |
| `CliSender` / `CliSenderShape` | `SessionSink` / `SessionSinkShape` | Port, dependencies.ts wiring. The `sendToCliClient` callback in `terminal-connection.use-case.ts` stays as a plain function dep — `dependencies.ts` bridges `SessionSink.send` to it. No use case imports the port directly. |

## Wiring changes

### `agent-session/dependencies.ts`

- Remove `EventFeed` / `EventFeedLive` from infra layer and service resolution
- Remove route creation (`createSessionRoutes`, `createTerminalRoutes`)
- Remove `routes` field from `AgentSessionServices` interface
- Keep REST route factory export so shell can call it
- Rename `EventPublisher` references to `DomainEventBus`
- Rename `CliSender` import to `SessionSink` (now from local port)

### `shell/dependencies.ts`

- Wire `EventFeedLive` (depends on `DomainEventBus` from agent-session)
- Create WS routes (events + terminal) using agent-session use cases
- Create REST routes by calling agent-session's route factory
- Assemble full route array and export

### `src/dependencies.ts` (root)

- Compose agent-session + shell
- Pass assembled routes to HTTP server via `createRoutesLayer`

## Session routes split

`session.routes.tsx` currently mixes REST and WebSocket concerns:

- **REST/form routes stay in agent-session:** `GET /`, `POST /sessions/create`, `POST /sessions/:id/kill`, `POST /sessions/:id/resume`, `POST /sessions/:id/delete`, `POST /sessions/clear-ended`, `POST /sessions/kill-all`, `GET /api/health`, `GET /api/sessions`, `POST /api/sessions`, `POST /api/sessions/:id/kill`, `POST /api/sessions/:id/resume`, `DELETE /api/sessions/:id`, `POST /api/sessions/clear-ended`, `POST /api/sessions/kill-all`
- **WebSocket route moves to shell:** `GET /ws/events` (the only route that depends on `EventFeed`)

After the split, `session.routes.tsx` in agent-session loses its `eventFeed` dependency entirely.

## Documentation updates

| File | Change |
|---|---|
| `packages/app/src/modules/agent-session/CLAUDE.md` | Remove EventFeed, WS routes, UI from "Owns". Rename EventPublisher to DomainEventBus, CliSender to SessionSink. |
| `packages/app/src/shell/CLAUDE.md` | Add EventFeed, WS routes, UI islands, DTO/mapper, dashboard view, ipc-protocol to "Owns". |
| `packages/app/src/modules/CLAUDE.md` | Minor wording updates if needed. |
| `packages/app/src/shared/kernel/CLAUDE.md` | Delete (directory removed). |
| `docs/architecture/overview.md` | Update mermaid diagram: rename Event Publisher to DomainEventBus, show EventFeed in shell, browser broadcast from shell. |
| `docs/architecture/modules.md` | Move routes/UI/EventFeed to shell section. Rename ports. Remove shared/kernel from diagram. |
| `packages/app/docs/adr/002-in-memory-event-bus.md` | Update terminology. |
| Root `CLAUDE.md` | Update if it references EventPublisher or shared/kernel. |

## Rationale (adversarial review summary)

Five approaches were evaluated:

| Approach | Verdict |
|---|---|
| **A. Move EventFeed + delivery adapters to shell** | Survives — cleanest boundary, requires moving routes too |
| B. Move EventFeed to shared/kernel | Killed — BrowserEvent is not cross-cutting, it is one-directional presentation |
| C. Just rename both services | Killed — correct diagnosis (naming), wrong treatment (ignores structural problem) |
| D. Delete EventFeed, inline mapping | Killed — EventFeed carries real runtime behavior (error isolation, Effect context capture) |
| E. Rename + move | Survives — but rename to SessionEventBus is the weak link |

Approach A was selected. The cascade to move routes was accepted after examining `session.routes.tsx` and finding a clean split point: REST routes (no EventFeed dependency) stay in agent-session, WS routes (EventFeed + terminal streaming) move to shell.

`shared/kernel/` elimination follows from having only one domain module — dependency inversion is achieved by agent-session defining ports that shell implements, without a third location.
