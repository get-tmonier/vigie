# Module architecture

vigie follows hexagonal architecture (ports & adapters) with one bounded domain module (`agent-session`) and an application shell (`shell`).

## Module map

```mermaid
graph LR
    subgraph app["@vigie/app"]
        subgraph agent_session["agent-session module"]
            subgraph as_domain["Domain"]
                AS_E["Session entity<br/>SessionId · SessionStatus<br/>Domain events · Errors"]
            end
            subgraph as_app["Application"]
                AS_UC["Use Cases<br/>spawn-session<br/>terminal-connection<br/>session-lifecycle<br/>session-queries<br/>session-cleanup<br/>check-resumability"]
                AS_PORT_OUT["Out ports<br/>SessionStore<br/>SessionLog<br/>AgentProcess<br/>SessionFeed<br/>SessionEventBus<br/>AgentAdapter / AgentCatalog<br/>CliChannel"]
            end
            subgraph as_infra["Infrastructure"]
                AS_IN["Adapters in<br/>HTTP routes (sessions, terminal WS)<br/>React SSR (dashboard, islands)"]
                AS_OUT["Adapters out<br/>SQLite repos (session + log)<br/>Bun PTY (AgentProcess impl)<br/>In-memory event bus<br/>In-memory session feed<br/>Claude agent adapter"]
            end
        end

        subgraph shell_mod["shell (application host)"]
            subgraph s_app["Application"]
                S_UC["run-daemon<br/>(startup loop)"]
                S_PORT_OUT["Out ports<br/>IpcServer<br/>ProcessManager"]
            end
            subgraph s_infra["Infrastructure"]
                S_IN["Adapters in<br/>IPC router<br/>CLI commands<br/>Unix socket client<br/>PTY relay"]
                S_OUT["Adapters out<br/>Unix socket server<br/>Bun process manager<br/>Claude runner adapter"]
            end
        end

        subgraph shared["shared / infra"]
            KERNEL["kernel<br/>IPC protocol · errors"]
            DB["DatabaseLive<br/>SQLite connection"]
        end
    end

    AS_PORT_OUT --> AS_OUT
    AS_IN --> AS_UC
    AS_UC --> AS_PORT_OUT
    S_IN -->|"delegates to"| AS_UC
    S_IN --> S_UC
    S_UC --> S_PORT_OUT
    S_PORT_OUT --> S_OUT
    AS_OUT --> DB
    S_OUT --> KERNEL
    AS_OUT --> KERNEL
```

## agent-session module

**Bounded context:** session lifecycle, agent process management, session output streaming.

### Domain

| Symbol | Role |
|---|---|
| `Session` | Aggregate root — state machine: `active → ended / error` |
| `SessionId` | Branded string type |
| `SessionStatus` | `active \| ended \| error` |
| Domain events | `session:started` · `session:ended` · `session:agent-id-detected` · `terminal:output` · `terminal:pty-resized` |

### Application — use cases

| Use case | Responsibility |
|---|---|
| `spawn-session` | Create session record, spawn PTY, wire output → storage + events |
| `session-lifecycle` | Transition session status (active, ended, error) |
| `session-queries` | Fetch sessions, terminal chunks, input history |
| `session-cleanup` | Delete session + associated data |
| `check-resumability` | Query FS to determine if a session can be resumed |

### Application — out ports

| Port | Shape | Implemented by |
|---|---|---|
| `session-store.port.ts` | `SessionStoreShape` | `SqliteSessionRepository` |
| `session-log.port.ts` | `SessionLogShape` | `SqliteTerminalRepository` |
| `agent-process.port.ts` | `AgentProcessShape` | `createPtyManager` (Bun PTY) |
| `session-feed.port.ts` | `SessionFeedShape` | In-memory pub/sub (`terminal-subscribers.ts`) |
| `session-event-bus.port.ts` | `SessionEventBusShape` | In-memory pub/sub (`session-event-bus.adapter.ts`) |
| `agent-adapter.port.ts` | `AgentAdapter` / `AgentCatalogShape` | `claudeAdapter` + `createAgentCatalog` |
| `cli-channel.port.ts` | `CliChannelShape` | `CliChannelLive` (writes back to IPC socket) |

### Infrastructure — adapters in

| Adapter | Exposes |
|---|---|
| `session.routes.tsx` | `POST /sessions/create` · `/kill` · `/resume` · `GET /api/sessions` |
| `terminal.routes.ts` | `GET /api/sessions/:id/chunks` · `WS /ws/terminal/:sessionId` |
| `dashboard.view.tsx` | React SSR — `GET /` |
| `SpawnSessionForm.island.tsx` | Client-side Vite island |

---

## shell

**Role:** Application host — not a domain module. No bounded context, no domain model.

Owns process lifecycle, HTTP/IPC server wiring, and CLI commands. Delegates all business logic to `agent-session`.

### Startup sequence (`run-daemon`)

```mermaid
sequenceDiagram
    participant D as shell
    participant DB as SQLite
    participant HTTP as HTTP Server
    participant IPC as IPC Server

    D->>DB: Create ~/.vigie/, write daemon.pid
    D->>DB: Cleanup orphaned sessions
    D->>DB: Prune old sessions (> 30 days)
    D->>DB: Check resumability for active sessions
    D->>HTTP: Start HTTP + WebSocket :19191
    D->>IPC: Start Unix socket server
    D->>D: Fork background fibers (prune hourly, resumability check every 5s)
```

### Infrastructure — adapters in

| Adapter | Role |
|---|---|
| `ipc-router.ts` | Route IPC messages to agent-session use cases |
| `claude.command` | Register + spawn Claude agent, relay PTY to stdout |
| `daemon.command` | `start / stop / restart / status / logs / attach` |
| `session-*.command` | `list / attach / resume` |
| `open.command` | Open browser dashboard |

---

## Dependency wiring

```mermaid
graph BT
    DB["DatabaseLive"]
    AS["AgentSessionLive"]
    SH["DaemonLive (shell)"]
    APP["AppLive"]

    DB --> AS
    SH --> APP
    AS --> APP
```

`AppLive` is the root composition in `src/dependencies.ts` — the single wiring point for `agent-session` + shell infrastructure.

## See also

- [System overview](./overview.md) — high-level components and communication protocols
