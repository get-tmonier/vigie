# @vigie/cli

The local daemon for [vigie](https://vigie.tmonier.com). Runs on your machine, under your control.

## What this is

A single Bun process that runs everything locally:

- **Embedded HTTP server** on `localhost:19191` — REST API + WebSocket + static UI
- **PTY manager** — spawns and manages AI agent sessions (Claude, aider, codex, generic)
- **SQLite database** at `~/.vigie/data.db` — sessions, terminal chunks, input history
- **Unix socket IPC** at `~/.vigie/daemon.sock` — CLI-to-daemon communication

```
Browser (SSR + client islands) <-> HTTP+WS (localhost:19191) <-> PTY manager <-> spawn(claude, aider, ...)
```

No remote servers. No cloud dependency. No auth required.

## Tech

Bun, Effect, @effect/platform-bun, TypeScript strict, ESM only.

## Build

```bash
bun install
bun run build        # -> standalone dist/vigie binary
```

## Verify

```bash
bun run verify       # knip -> biome check -> typecheck -> test -> build
```

## License

[MIT](../../LICENSE)
