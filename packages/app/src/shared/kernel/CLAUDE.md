# shared/kernel

Cross-cutting wire protocols owned by no single bounded context.

## What belongs here

- IPC message schemas shared between daemon and CLI commands
- Tagged errors used across module boundaries (e.g. `AgentRunnerError`)

## What does NOT belong here

If something moves here to escape an import error, that is a boundary smell — fix the module design instead.

## agentType convention

`agentType` in IPC schemas is typed as `v.picklist(['claude'])`. When adding a new agent,
extend the picklist: `v.picklist(['claude', 'opencode'])`. New agents also require an
`AgentAdapter` in `agent-session/infrastructure/adapters/out/agents/` registered in `agent-registry.ts`.
