# ADR 005: SQLite Local-Only Persistence

**Status:** Accepted  
**Date:** 2026-04-08

## Context

vigie must persist session state, terminal chunks, and input history across daemon restarts. Options:
1. PostgreSQL/MySQL (network DB, high overhead for single-machine use)
2. SQLite (embedded, zero-ops, local-only)
3. File-based key/value store or JSON (limited query capability)

vigie is "local-first" for software engineers working on a single machine. A remote database is unnecessary overhead and creates a deployment burden.

## Decision

Use SQLite (`~/.vigie/data.db`) as the sole persistent store. The Bun daemon holds a single connection pool to SQLite; all queries are synchronous (or wrapped in async with `bun:sqlite`).

## Consequences

**Advantages:**
- Zero configuration: file-based, no separate server
- Zero external dependency: SQLite is bundled with Bun
- ACID transactions: data is consistent even on crash
- Query language: SQL is well-understood; migrations are straightforward
- Size: the entire database for years of session history is typically < 100 MB

**Limitations:**
- Single-writer: only the daemon can write (no remote access)
- No multi-machine sync: a session on machine A does not appear on machine B
- Scalability ceiling: millions of terminal chunks become slow (but vigie will never store that much per user)
- No clustering: impossible to run daemon replicas

**Data persisted:**
- `sessions`: id, agent_type, mode, cwd, git_branch, git_remote_url, repo_name, started_at, ended_at, status, exit_code, agent_session_id, resumable
- `terminal_chunks`: session_id, data (base64), timestamp, seq (sequence number)
- `input_history`: session_id, text, source (cli/browser), timestamp
- `event_queue`: serialized domain events (currently unused for replay; reserved for future audit trail)

**Data not persisted:**
- In-memory event bus (by ADR 002)
- HTTP session cookies (none used; UI is not authenticated)
- Real-time terminal buffers (reconstructed from chunks on resume)

**Future implications:**
- If enterprise multi-machine use is needed, migrate to PostgreSQL + replication (breaking change)
- For now, SQLite is the correct tool for the local-first constraint
- Backups are simple: copy `~/.vigie/data.db` (can be automated)
- Data recovery: SQLite corruption is rare; if it occurs, session history is lost but daemon restarts cleanly
