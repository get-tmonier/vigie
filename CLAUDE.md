# Tmonier

Local-first agent supervisor for software engineers. "Your crew. Under your watch."
Real-time visibility into AI agent activity, drift detection, token cost guardrails, checkpoints & rollback. BYOA (Bring Your Own AI). Currently in Phase 0 (foundation).

## Stack

- **Bun** everywhere — runtime, package manager, test runner, daemon compilation
- **Turborepo** monorepo with Bun workspaces
- **Biome** for lint + format (no ESLint, no Prettier) — config at root `biome.json`
- **TypeScript strict** across all packages, ESM only

## Packages

| Package | Path | Key libraries |
|---|---|---|
| `@tmonier/api` | `packages/api/` | Hono, Effect, Kysely, PostgreSQL |
| `@tmonier/ui` | `packages/ui/` | React, TanStack Start/Router |
| `@tmonier/shared` | `packages/shared/` | ts-rest contracts, Valibot schemas |
| `@tmonier/tokens` | `packages/tokens/` | Design tokens — CSS + JS exports |
| `@tmonier/landing` | `packages/landing/` | Astro 5 + Tailwind v4 (Cloudflare Pages) |

## Architecture

**Overall:** `Browser ↔ TanStack Start (SSR, app.tmonier.com) ↔ Hono+Effect (API/WS, api.tmonier.com) ↔ WebSocket ↔ Daemon Bun (local) ↔ spawn(git, claude...)`

- **2 Railway services:** TanStack Start SSR (`app.tmonier.com`) + Hono+Effect+PostgreSQL (`api.tmonier.com`)
- **Backend:** hexagonal/DDD — Effect for domain/services, Hono as HTTP adapter, Kysely+PostgreSQL for persistence
- **Daemon:** proxy only — spawn, stream, control signals. No business logic. Separate public repo (`get-tmonier/cli`)
- **Shared:** ts-rest contracts + Valibot schemas consumed by api + ui
- **Frontend:** TanStack Start SSR + file-based routing
- **Auth:** Better Auth (GitHub OAuth) · **ORM:** Kysely · **Payments:** Stripe

## Verify pipeline

Pre-commit runs `bun run verify` via simple-git-hooks:
```
knip → biome check → typecheck → test → build
```

## Commands

```bash
bun install                                    # install all dependencies
bun turbo dev                                  # dev servers (api + ui)
bun run dev:landing                            # dev server for landing only
bun turbo build                                # build all packages
bun turbo check                                # biome check
bun turbo check -- --fix                       # biome check + fix
bun turbo typecheck                            # typescript check
bun turbo test                                 # run tests
bun run verify                                 # full pipeline: knip → check → typecheck → test → build
bun run verify:fix                             # auto-fix then verify
bun turbo build --filter=@tmonier/landing      # build single package
```

## Rules

- **Feature branches only** — never commit directly to `main`. Rebase on `main` before opening a PR.
- **Never `git push` directly** — always ask before pushing to any remote.
- **Conventional Commits** — `type(scope): description` (e.g. `feat(api): add auth endpoint`, `fix(tokens): correct color value`).
- **No AI attribution** — never add `Co-Authored-By` or any Claude/AI mention in commit messages.
- **Bun only** — never use npm, pnpm, yarn, or npx. Use `bun` and `bunx`.
- **Pinned versions** — no `^` or `~` prefixes in `package.json` dependencies.

## Conventions

- CSS vars from `@tmonier/tokens` — design tokens are the single source of truth
- Google Fonts loaded via `<link>` tags (not `@import` in CSS)
- Landing page deploys to **Cloudflare Pages** — output: `packages/landing/dist/`
- No `any` — strict TypeScript everywhere
- **Effect** for all backend business logic (no try/catch)
- **Valibot** for all schemas (no Zod)
- **Biome** only (no ESLint/Prettier)
- **ESM only** — all packages use ESM. If a dependency requires CJS, stop and alert the user (find an ESM alternative or skip it)
