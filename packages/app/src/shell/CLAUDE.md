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

## Implements ports from other modules

- `CliSender` (`#shared/kernel/contracts/cli-sender.ts`): Implemented in `daemon/dependencies.ts` via callback injection. The port lives in `shared/kernel/contracts/` (cross-module contract) and is used by `agent-session` use cases, but fulfilled by `daemon` (which owns the IPC channel). This is intentional dependency inversion — the composition root wires the adapter without violating module boundaries.

## Key conventions
- Session IDs are opaque `string` here — branding is agent-session's concern.
- Never import from other modules. Use ports in `application/ports/in/`.
- `daemon/dependencies.ts` only exports daemon-specific infrastructure layers.
