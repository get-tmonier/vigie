# agent-session module

## Owns
- Session lifecycle (register, spawn, resume, end, delete)
- Agent process management (spawn, resize, kill, output) — via `AgentProcess` port
- Session output log (terminal chunks and input history) — via `SessionLog` port
- Session live feed (real-time output streaming to viewers) — via `SessionOutput` port
- Agent adapters (`AgentSpec` interface + `AgentCatalog`) — spawn config and resumability per agent
- Session event publishing — via `SessionEventBus` port
- CLI back-channel to attached vigie CLI client — via `CliChannel` port
- `SessionId` branded type

## Does not own
- HTTP serving or WebSocket broadcasting
- IPC protocol details
- Daemon config

## Port map (application/ports/out/)

| Port | Shape | Role |
|---|---|---|
| `session-store.port.ts` | `SessionStoreShape` | Session entity CRUD |
| `session-log.port.ts` | `SessionLogShape` | Terminal output + input history (SQLite) |
| `agent-process.port.ts` | `AgentProcessShape` | Live agent process management (PTY) |
| `session-output.port.ts` | `SessionOutputShape` | Real-time output streaming to viewers |
| `session-event-bus.port.ts` | `SessionEventBusShape` | Session lifecycle event pub/sub |
| `agent-catalog.port.ts` | `AgentSpec` / `AgentCatalogShape` | Spawn config + resumability per agent |
| `cli-channel.port.ts` | `CliChannelShape` | Back-channel to the vigie CLI client (IPC) |

## Key conventions
- `SessionId` branded type lives here. Use `SessionId as makeSessionId` for construction.
- Events published via `SessionEventBus` port. Daemon adapts events to browser format at root `src/dependencies.ts`.
- `agent-session/dependencies.ts` exports infrastructure layers and use case factories.
- Use cases are plain factory functions. `AgentProcess` (PTY) is wired as a factory in `AgentSessionLive`.
- Never import from `#shell/`. If shell-level behavior is needed, use a callback dep or a port.

## Data flow

```
Agent outputs bytes
  │
  ├─→ AgentProcess receives raw bytes
  │         │
  │         ├─→ SessionLog.appendChunk()      — SQLite, for history/replay
  │         │
  │         ├─→ SessionOutput.publish()       — live WebSocket fans to browser viewers
  │         │
  │         └─→ CliChannel.send(connId, ...)  — sends back to attached vigie CLI window
  │
  └─→ (PTY OS pipe handles kernel I/O, invisible to application layer)
```
