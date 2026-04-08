# ADR 004: Unix Socket IPC for CLI–Daemon Communication

**Status:** Accepted  
**Date:** 2026-04-08

## Context

The CLI (`vigie daemon start`, `vigie session list`, etc.) must communicate with the long-running daemon to fetch state and trigger actions. Options:
1. HTTP/TCP on localhost (simple, cross-platform)
2. Unix socket on `~/.vigie/daemon.sock` (local only, faster, traditional Unix)
3. Shared memory or memory-mapped files (complex, non-portable)

The daemon already runs on localhost:19191 for the browser UI, but that is not suitable for CLI communication — the CLI may not run in a browser context, and mixing UI WebSocket and CLI RPC on the same HTTP port risks confusion.

## Decision

Use Unix socket at `~/.vigie/daemon.sock` for CLI–daemon IPC. The daemon listens on the socket; CLI connects and sends/receives JSON-RPC or custom framed messages.

## Consequences

**Advantages:**
- Local only: no exposure to network (safer than localhost:3000)
- Fast: no TCP stack overhead
- Traditional Unix idiom: socket at `~/.daemon.sock` is familiar to system programmers
- Automatic cleanup: socket file is ephemeral, deleted on daemon restart
- Prevents accidental cross-machine exposure

**Limitations:**
- Unix-only (no Windows native support)
- Cannot serve remote CLI instances (by design — vigie is local-first)
- Socket path hardcoded in config; no service discovery

**Design implications:**
- Socket path is owned by daemon config (src/config.ts)
- CLI connection errors must be clear: daemon not running, socket missing, permission denied
- Daemon graceful shutdown closes the socket before killing sessions

**Future implications:**
- If multi-machine support is added (future decision), this IPC layer must be replaced with HTTP/gRPC
- For now, enforces the local-first constraint
