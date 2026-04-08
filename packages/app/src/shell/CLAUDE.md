# shell

Application shell — process lifecycle, HTTP/IPC server, CLI commands.
Not a domain module. No bounded context, no domain model.

## Owns
- Process lifecycle (startup, shutdown, signal handling, cleanup)
- HTTP + WebSocket server (routes, server config)
- IPC server (Unix socket server, IPC router, IPC commands)
- CLI commands (vigie daemon, vigie open, vigie session, vigie claude)
- Daemon config (port, socket path, vigie home)
- Process manager (spawn/kill daemon process)

## Does not own
- Session state or PTY handles
- Terminal chunks or input history
- Agent adapters or agent logic

## Key conventions
- `src/shell/` may import from `src/modules/agent-session/` — it is the composition host
- `src/shell/` must NOT be imported from `src/modules/` — domain must not know about its host
- `src/dependencies.ts` is the single composition root; `src/shell/dependencies.ts` is shell-only wiring
- `src/shell/application/ports/in/` contains only `ipc-client.port.ts` — the IPC client type for CLI commands
- `src/shell/application/ports/out/` contains real infrastructure abstractions (`IpcServer`, `ProcessManager`)
