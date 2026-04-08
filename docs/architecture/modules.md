# Module architecture

vigie follows hexagonal architecture (ports & adapters) with two bounded modules.

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
                AS_PORT_OUT["Out ports<br/>SessionRepository<br/>TerminalRepository<br/>PtySpawner<br/>AgentAdapter / AgentRegistry<br/>EventPublisher<br/>ResumabilityChecker<br/>CliSender"]
            end
            subgraph as_infra["Infrastructure"]
                AS_IN["Adapters in<br/>HTTP routes (sessions, terminal WS)<br/>React SSR (dashboard, islands)"]
                AS_OUT["Adapters out<br/>SQLite repos<br/>Bun PTY spawner<br/>In-memory event publisher<br/>FS resumability checker<br/>Claude agent adapter"]
            end
        end

        subgraph daemon_mod["daemon module"]
            subgraph d_domain["Domain"]
                D_E["DaemonInfo<br/>Errors"]
            end
            subgraph d_app["Application"]
                D_UC["Use Cases<br/>run-daemon (main loop)"]
                D_PORT_IN["In ports<br/>spawn-session · session-lifecycle<br/>terminal-connection · startup-ops<br/>ipc-client"]
                D_PORT_OUT["Out ports<br/>IpcServer<br/>ProcessManager"]
            end
            subgraph d_infra["Infrastructure"]
                D_IN["Adapters in<br/>IPC router<br/>CLI commands<br/>Unix socket client<br/>PTY relay"]
                D_OUT["Adapters out<br/>Unix socket server<br/>Bun process manager<br/>Claude runner adapter"]
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
    D_PORT_IN -.->|"delegates to"| AS_UC
    D_IN --> D_UC
    D_UC --> D_PORT_OUT
    D_PORT_OUT --> D_OUT
    AS_OUT --> DB
    D_OUT --> KERNEL
    AS_OUT --> KERNEL
```

## agent-session module

**Bounded context:** session lifecycle, PTY I/O, terminal streaming.

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
| `terminal-connection` | Route stdin/resize between CLI/browser channels and PTY |
| `session-lifecycle` | Transition session status (active, ended, error) |
| `session-queries` | Fetch sessions, terminal chunks, input history |
| `session-cleanup` | Delete session + associated data |
| `check-resumability` | Query FS to determine if a session can be resumed |

### Application — out ports

| Port | Implemented by |
|---|---|
| `SessionRepository` | `SqliteSessionRepository` |
| `TerminalRepository` | `SqliteTerminalRepository` |
| `PtySpawner` | `BunPtySpawner` |
| `AgentAdapter` + `AgentRegistry` | `ClaudeAdapter` + `AgentRegistry` |
| `EventPublisher` | In-memory pub/sub |
| `ResumabilityChecker` | `FsResumabilityChecker` |
| `CliSender` | `CliSenderLive` (writes back to IPC socket) |

### Infrastructure — adapters in

| Adapter | Exposes |
|---|---|
| `session.routes.tsx` | `POST /sessions/create` · `/kill` · `/resume` · `GET /api/sessions` |
| `terminal.routes.ts` | `GET /api/sessions/:id/chunks` · `WS /ws/terminal/:sessionId` |
| `dashboard.view.tsx` | React SSR — `GET /` |
| `SpawnSessionForm.island.tsx` | Client-side Vite island |

---

## daemon module

**Bounded context:** daemon lifecycle, IPC server, CLI command dispatch.

### Application — use cases

| Use case | Responsibility |
|---|---|
| `run-daemon` | Startup sequence, HTTP+WS server, IPC server, periodic maintenance |

### Startup sequence (`run-daemon`)

```mermaid
sequenceDiagram
    participant D as Daemon
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
    D["DaemonLive"]
    APP["AppLive"]

    DB --> AS
    DB --> D
    AS --> APP
    D --> APP
```

`AppLive` is the root composition provided to the daemon entry point.

## See also

- [System overview](./overview.md) — high-level components and communication protocols
