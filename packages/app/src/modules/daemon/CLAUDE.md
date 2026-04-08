# daemon module

## Owns
- Daemon lifecycle (startup, shutdown, signal handling)
- HTTP + WebSocket server (routes, server config)
- IPC server (Unix socket server, IPC router)
- CLI command handling (vigie daemon, vigie open, vigie session)
- Daemon config (port, socket path, vigie home)
- Process manager (spawn/kill daemon process)

## Does not own
- Session state or PTY handles
- Terminal chunks or input history
- Agent adapters or agent logic

## Key conventions
- Session IDs are opaque `string` here — branding is agent-session's concern.
- Never import from `#modules/agent-session/`. Use ports in `application/ports/in/`.
- `daemon/dependencies.ts` only exports daemon-specific infrastructure layers.
