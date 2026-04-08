# shared/kernel

Cross-cutting wire protocols owned by no single bounded context.

## What belongs here

- IPC message schemas shared between daemon and CLI commands
- Tagged errors used across module boundaries (e.g. `AgentRunnerError`)

## What does NOT belong here

If something moves here to escape an import error, that is a boundary smell — fix the module design instead.

## agentType convention

`agentType` in IPC schemas is typed as `v.string()` (open) to support multi-agent extensibility without requiring schema changes per new agent. Currently registered values: `"claude"`. New agents add an `AgentAdapter` in `agent-session/infrastructure/adapters/out/agents/` and register in `agent-registry.ts`.
