# @tmonier/cli

The local daemon for [Tmonier](https://tmonier.com). Runs on your machine, under your control.

## What this is

The daemon that spawns and monitors AI agents locally. It connects to `api.tmonier.com` via WebSocket. No business logic lives here — it's a pure proxy: spawn, stream, control signals.

```
api.tmonier.com ↔ WebSocket ↔ Daemon (this repo) ↔ spawn(git, claude...)
```

## What it does

- Spawns local processes (git, AI agents) on command from the backend
- Streams stdout/stderr back to the backend via WebSocket
- Receives control signals (pause, resume, checkpoint, rollback)

## What it doesn't do

- Does **not** parse, validate, or persist anything — all logic lives in the backend
- Does **not** send telemetry or phone home beyond the authenticated WebSocket

## Tech

Bun (runtime + compiler), TypeScript strict, ESM only.

## Build

```bash
bun install
bun run build        # → standalone dist/tmonier binary
```

## Verify

```bash
bun run verify       # knip → biome check → typecheck → test → build
```

## License

[GPL-3.0](LICENSE)
