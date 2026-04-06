# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Fully local single-process daemon: no remote API, no cloud dependency — everything runs on `localhost:19191`
- `@effect/platform-bun` HTTP server embedded in daemon (replaced Hono) — serves REST, WebSocket, and React SSR from one process
- React SSR rendered by the daemon; client interactivity via Vite-bundled islands (`*.island.tsx`)
- Redux Toolkit slice (`sessions.slice`) + WebSocket event bus for reactive client-side session state
- DDD hexagonal architecture: rich `Session` domain entity, `AgentAdapter` port, `AgentRegistry` — agent-agnostic by design
- Full Effect-TS adoption: `SessionService`, `EventPublisher`, PTY relay, intervals, and WebSocket deferreds all effectified
- `DashboardLayout` component in `#shared/ui` — layout shell extracted from the session module (FSD alignment)
- Test file colocation with source modules (`*.unit.test.ts` / `*.integration.test.ts`)
- `vigie claude` command for interactive Claude Code sessions with PTY relay
- `vigie daemon start/stop/status` subcommands for daemon lifecycle management
- `vigie session list / attach / resume` CLI commands
- Detach/attach lifecycle: `Ctrl+B d` to detach without stopping the session
- SQLite persistence for sessions, terminal chunks, and input history (`~/.vigie/data.db`)
- Unix socket IPC between CLI and daemon (`~/.vigie/daemon.sock`)
- Git context detection (repo, branch, dirty state) attached to each session
- Keybind interceptor and live status bar footer in the CLI TUI

### Fixed

- Session resume reuses the existing session ID and reactivates the DB row in-place (no duplicate session)
- `Ctrl+C` no longer marks a session non-resumable — disconnect handler checks whether session already ended
- PTY dimensions forced to CLI terminal size on attach, with immediate resize notification
- CLI attached to a browser-started session now receives the PTY exit notification
- Raw terminal state restored before process exit — host terminal no longer freezes after `Ctrl+C` / SIGTERM
- Terminal output no longer duplicated on resume — TUI renderer state cleared before replaying buffered output
- Client bundle built before daemon starts in dev mode
- `Effect.catchAllDefect` replaced with `catchDefect`; process exit handlers added for uncaught errors

### Changed

- Removed remote API and all cloud dependencies — vigie is now fully local
- Source structure aligned with Feature-Sliced Design: `src/modules/` with `#modules/*` subpath aliases
- `@vigie/ui` package removed; UI colocated in `packages/app` under `src/modules/`
- All logging migrated from `console.log/error` to `Effect.log*`
- Build pipeline: `bun run verify` (knip → biome → typecheck → test → build)
