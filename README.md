# Tmonier

**Local-first agent supervisor for software engineers.**
*Your crew. Under your watch.*

Real-time visibility into AI agent activity, loop/drift detection, token cost guardrails, checkpoints & rollback — all running locally. Bring Your Own AI (BYOA).

[tmonier.com](https://tmonier.com)

## Architecture

```
Browser ↔ TanStack Start (SSR, app.tmonier.com) ↔ Hono+Effect (API/WS, api.tmonier.com) ↔ WebSocket ↔ Daemon Bun (local) ↔ spawn(git, claude...)
```

- **App** — TanStack Start SSR on Railway (`app.tmonier.com`)
- **API** — Hono + Effect + PostgreSQL on Railway (`api.tmonier.com`)
- **Daemon** — local Bun binary (`@tmonier/cli`, separate repo `get-tmonier/cli`), connects via WebSocket

## Monorepo structure

| Package | Path | Key libraries |
|---|---|---|
| `@tmonier/api` | `packages/api/` | Hono, Effect, Kysely, PostgreSQL |
| `@tmonier/ui` | `packages/ui/` | React, TanStack Start/Router |
| `@tmonier/shared` | `packages/shared/` | ts-rest, Valibot |
| `@tmonier/tokens` | `packages/tokens/` | Design tokens (CSS + JS exports) |
| `@tmonier/landing` | `packages/landing/` | Astro 5, Tailwind v4 |

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
