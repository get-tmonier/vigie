# Vigie

**Local-first agent supervisor for software engineers.**
*You Keep The Helm.*

Real-time visibility into AI agent activity, loop/drift detection, token cost guardrails, checkpoints & rollback — all running locally. Bring Your Own AI (BYOA).

[vigie.tmonier.com](https://vigie.tmonier.com)

## Architecture

```
Browser ↔ TanStack Start (SSR, app.vigie.tmonier.com) ↔ Hono+Effect (API/WS, api.vigie.tmonier.com) ↔ WebSocket ↔ CLI daemon (local) ↔ spawn(git, claude...)
```

- **App** — TanStack Start SSR on Railway (`app.vigie.tmonier.com`)
- **API** — Hono + Effect + PostgreSQL on Railway (`api.vigie.tmonier.com`)
- **CLI** — local Bun binary (`@vigie/cli`), connects via WebSocket

## Monorepo structure

| Package | Path | Key libraries |
|---|---|---|
| `@vigie/api` | `packages/api/` | Hono, Effect, Kysely, PostgreSQL |
| `@vigie/ui` | `packages/ui/` | React, TanStack Start/Router |
| `@vigie/cli` | `packages/cli/` | Effect, Bun PTY, xterm headless |
| `@vigie/shared` | `packages/shared/` | ts-rest, Valibot |
| `@vigie/tokens` | `packages/tokens/` | Design tokens (CSS + JS exports) |
| `@vigie/landing` | `packages/landing/` | Astro 5, Tailwind v4 |

## Tech stack

Bun (runtime, package manager, test runner) · Turborepo · Biome (lint/format) · TypeScript strict · ESM only

## Getting started

```bash
bun install            # install all dependencies
bun turbo dev          # dev servers
bun turbo build        # build all packages
```

## Verify pipeline

```bash
bun run verify         # knip → biome check → typecheck → test → build
bun run verify:fix     # auto-fix what can be fixed, then verify
```

Runs automatically as a pre-commit hook via `simple-git-hooks`.

## License

[GPL-3.0](./LICENSE)
