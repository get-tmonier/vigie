# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `tmonier claude` command for running Claude Code sessions with streaming output and session summaries
- `tmonier daemon start/stop/status/logs` subcommands for daemon lifecycle management
- Background daemon process for managing persistent backend connections and agent executions
- IPC communication between CLI and daemon via Unix sockets
- Effect-TS for declarative, type-safe program construction and error handling
- Git context detection (repo, branch, dirty state) for session initialization
- Modular source structure under `src/modules/` (auth, backend, daemon, session)
- `tmonier login` command with browser-based OAuth flow and `--token` manual login
- `tmonier logout` command to clear saved credentials
- Credential storage in `~/.tmonier/credentials.json` with restrictive file permissions (0600)
- `TMONIER_TOKEN` env var support as alternative to stored credentials
- `TMONIER_APP_URL` config for auth redirect target
- WebSocket authentication via `daemon:hello` token field and query parameter on upgrade
- Tests for credentials I/O, login callback (CSRF/XSS), config defaults, IPC messages, Claude stream, and git context
- Interactive Claude sessions via PTY spawn and bidirectional terminal relay (`tmonier claude` interactive mode)
- `tmonier session list` command to display active and past sessions
- `tmonier session attach <id>` command to reattach to a running session
- `tmonier session resume <id>` command with smart reattach using deterministic Claude session IDs
- Detach/attach lifecycle: press `Ctrl+D` to detach from a session without stopping it
- Keybind interceptor for in-session keyboard shortcuts
- Live status bar footer rendered in gold via TUI renderer, updating every second
- Virtual terminal emulator (`vterm`) for tracking agent viewport state
- Event-driven dirty tracking in the virtual terminal for efficient screen updates
- SQLite persistence for session state with reconnect sync
- Input history persistence per session with ANSI escape stripping
- Session management actions from the backend (spawn, kill, resume) with resumable tracking
- Browser-initiated session spawn, kill, and directory listing handled by daemon
- Daemon `fg` mode, `restart` subcommand, and accurate uptime reporting
- Diagnostic logging for terminal resize relay

### Fixed

- WebSocket inactivity timeout (60 s) to prevent stale connections
- Ping/pong heartbeat to keep connections alive and verify responsiveness
- Login callback server now binds to `127.0.0.1` instead of all interfaces
- Force process exit after `claude` command completes to prevent hanging

### Changed

- Refactored CLI to daemon-based architecture for persistent agent sessions
- WebSocket client moved under `modules/backend` with adapter/port separation
- PTY ownership moved from CLI to daemon process
- Initial project scaffolding (Bun, Biome, TypeScript strict, ESM only)
- Build pipeline: `bun run verify` (knip, biome check, typecheck, test, build)
- Standalone binary compilation via `bun build --compile`
- Valibot message schemas for downstream and upstream message contracts
