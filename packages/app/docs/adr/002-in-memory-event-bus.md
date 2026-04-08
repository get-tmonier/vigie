# ADR 002: In-Memory Event Bus (No Persistence)

**Status:** Accepted  
**Date:** 2026-04-08

## Context

The daemon publishes domain events (`SessionSpawned`, `TerminalOutput`, `SessionEnded`, etc.) to notify the dashboard of session lifecycle changes and terminal updates in real time. The browser subscribes via WebSocket (`/ws/events`).

Events could be persisted to SQLite for replay on reconnection, but this adds complexity: event schema versioning, storage overhead, and recovery logic that rarely matters in practice.

## Decision

Events are published to an in-memory event bus and broadcast to all connected WebSocket clients. **Events are not persisted.** When the daemon restarts or a client reconnects, historical events are lost.

## Consequences

**Advantages:**
- Simple: use Effect's broadcast channel or pub/sub, no database writes
- Fast: no I/O latency for event publication
- Clear semantics: events are transient UI updates, not durable state

**What is lost on restart:**
- Historical terminal output between the last session snapshot and the crash
- Session lifecycle breadcrumbs (e.g., "spawned at 14:32, paused at 14:55")
- Buffered input history (though persisted in SQLite for resume)

**Why acceptable:**
- Session resumability depends on session state (SQLite) and terminal history (persisted chunks), not event history
- UI reconnection triggers a fresh API call to `/api/sessions` anyway (client fetches current state)
- Terminal output is preserved in SQLite chunks; only the "live stream" between last checkpoint and crash is lost
- For debugging: developers can attach to the daemon process to see live events, or check SQLite for historical chunks

**Future implications:**
- If audit trails or compliance requires event history, a separate append-only log can be added without changing session logic
- Multi-machine support may require durable event storage for remote replay (future decision)
