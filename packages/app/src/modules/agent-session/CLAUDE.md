# agent-session module

## Owns
- Session lifecycle (register, spawn, resume, end, delete)
- PTY management (spawn, resize, kill, output)
- Terminal chunks (append, query)
- Input buffering and history
- Agent adapters (`AgentAdapter` port + `AgentRegistry`)
- Resumability checking
- Domain events (published via `EventPublisher` port)
- `SessionId` branded type

## Does not own
- HTTP serving or WebSocket broadcasting
- IPC protocol details
- Daemon config

## Key conventions
- `SessionId` branded type lives here. Use `SessionId as makeSessionId` for construction.
- Events published via `EventPublisher` port. Daemon adapts events to browser format at root `src/dependencies.ts`.
- `agent-session/dependencies.ts` exports infrastructure layers and use case factories.
- Use cases are plain factory functions sharing a `PtyRegistry` internal state module.
- Never import from `#modules/daemon/`. If daemon-level behavior is needed, use a callback dep.
