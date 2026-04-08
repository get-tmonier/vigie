# shared/kernel

Cross-cutting wire protocols owned by no single bounded context.

## What belongs here

- `contracts/` — inter-module contracts: IPC message schemas and cross-module Effect service ports
- `errors.ts` — tagged errors used across module boundaries (e.g. `AgentRunnerError`)

## contracts/

- `ipc-protocol.ts` — Valibot schemas for the Unix socket protocol (Session ↔ Daemon). Two union types: `SessionToDaemon` (messages from CLI runner to daemon) and `DaemonToSession` (messages from daemon to CLI runner).
- `cli-sender.ts` — Effect `ServiceMap.Service` port for sending messages from agent-session use cases back to a connected CLI client. Implemented by the daemon layer at the composition root (`daemon/dependencies.ts`) — intentional dependency inversion.

## agentType convention

`agentType` in IPC schemas is typed as `v.picklist(['claude'])`. When adding a new agent,
extend the picklist: `v.picklist(['claude', 'opencode'])`. New agents also require an
`AgentAdapter` in `agent-session/infrastructure/adapters/out/agents/` registered in `agent-registry.ts`.

## What does NOT belong here

If something moves here to escape an import error, that is a boundary smell — fix the module design instead.
