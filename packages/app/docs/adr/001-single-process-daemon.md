# ADR 001: Single Process Daemon

**Status:** Accepted  
**Date:** 2026-04-08

## Context

vigie needs to manage multiple concurrent agent sessions (Claude, Aider, etc.), each spawning a PTY and streaming terminal output. The HTTP server must serve the React dashboard and WebSocket for real-time terminal updates. The daemon must manage IPC communication with the CLI.

A multi-process architecture (e.g., separate HTTP server process + daemon supervisor) would require inter-process communication for PTY state, terminal events, and session lifecycle. This adds complexity, debugging difficulty, and synchronization challenges.

## Decision

vigie runs as a single Bun process that:
- Embeds the HTTP server (Effect HTTP + WebSocket on localhost:19191)
- Manages PTY spawning and output streaming in the same process
- Exposes the Unix socket IPC server for CLI communication
- Accesses SQLite directly (single connection pool, no network coordination)

## Consequences

**Advantages:**
- Simple architecture: all state lives in one Effect.Layer dependency graph
- No inter-process messaging overhead
- Straightforward session lifecycle: spawn → manage → kill all in one process
- Real-time event propagation via in-memory event bus (no persistence needed)
- Single crash point — if the daemon dies, the UI and CLI both notice immediately

**Limitations:**
- Cannot scale to multiple machines without fundamental redesign
- A crash kills all active sessions (though resume mitigates this)
- No multi-machine clustering for enterprise use cases
- Daemon restarts lose in-memory event history (acceptable: events are transient UI updates)

**Future implications:**
- If multi-machine support is needed, the architecture must shift to distributed IPC
- Resumability is essential because the daemon will restart during development
- Session persistence (SQLite) is critical to recovery after daemon crashes
