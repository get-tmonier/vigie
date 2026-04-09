# ADR 006: Hexagonal Architecture (Ports & Adapters)

**Status:** Accepted  
**Date:** 2026-04-08

## Context

vigie's daemon mixes multiple concerns: domain logic (session lifecycle, resumability), infrastructure (PTY, SQLite, Unix socket, HTTP), and application orchestration (use cases). Without a clear boundary, domain logic drifts into infrastructure code and becomes untestable.

An early prototype wired PTY calls directly into session management. This made unit testing impossible without spawning real processes and tightly coupled business rules to implementation details.

## Decision

The `agent-session` module follows hexagonal architecture (ports & adapters):

- **Domain layer** — pure TypeScript entities, value objects, domain events, and errors. No I/O.
- **Application layer** — use cases (factory functions) that depend only on port interfaces. No infrastructure imports.
- **Ports** — TypeScript interfaces in `application/ports/out/` that define the capabilities the application needs from infrastructure (e.g. `SessionStoreShape`, `AgentProcessShape`, `SessionOutputShape`). Ports are Effect `ServiceMap.Service` tags.
- **Infrastructure layer** — concrete implementations of ports (`SqliteSessionRepository`, `createPtyManager`, `SessionOutputLive`, etc.), wired at the composition root (`dependencies.ts`).

The `shell` module is the composition host and application shell — it wires ports to implementations and owns HTTP/IPC/CLI infrastructure. It may import from `agent-session`; `agent-session` must never import from `shell`.

## Consequences

**Advantages:**
- Use cases are testable with in-memory port stubs — no real database or PTY required
- Domain logic is isolated from infrastructure churn (e.g. swapping SQLite for another store touches only one adapter)
- Port interfaces make the application's external dependencies explicit and auditable
- Enforced by import rules: `modules/agent-session` must not import from `shell/`

**Trade-offs:**
- More files and indirection than a flat service-layer approach
- Adding a new capability requires defining a port, implementing an adapter, and wiring the Layer

**File layout:**
```
application/
  ports/out/         ← port interfaces (TypeScript interfaces + ServiceMap.Service tags)
  use-cases/         ← factory functions, depend only on ports
domain/              ← entities, value objects, events, errors (no I/O)
infrastructure/
  adapters/in/       ← HTTP routes, IPC handlers (inbound)
  adapters/out/      ← SQLite repos, PTY, event bus, agent adapters (outbound)
```

**Future implications:**
- New agents (aider, codex, opencode) only require new `AgentSpec` implementations in `adapters/out/agents/` — the domain and use cases are untouched
- Infrastructure swaps (e.g. SQLite → another store) are localized to one adapter file
