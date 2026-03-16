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
  - **Module structure:** each module follows `domain/`, `ports/`, `commands/`, `queries/`, `adapters/primary/`, `adapters/secondary/`
  - **CQRS:** commands (`*.command.ts`) for writes, queries (`*.query.ts`) for reads
  - **File naming:** `*.port.ts`, `*.command.ts`, `*.query.ts`, `*.adapter.ts`
  - **Effect patterns:** services via `ServiceMap.Service`, errors via `Data.TaggedError`, DI via `Layer`, no try/catch
  - **Tests split:** `*.unit.test.ts` for domain/commands/queries, `*.integration.test.ts` for adapters. Tests live in `__tests__/` co-located with source
- **Daemon:** proxy only — spawn, stream, control signals. No business logic. Separate public repo (`get-tmonier/cli`)
- **Shared:** ts-rest contracts + Valibot schemas consumed by api + ui
- **Frontend:** TanStack Start SSR + file-based routing
  - **Feature-Sliced Design** in `@tmonier/ui` — layers: `app → shared → entities → features → widgets → pages → routes`
  - Each slice organized as `api/`, `model/`, `ui/` sub-folders
  - No cross-slice imports (features don't import from other features)
  - State management: React hooks only (no Redux/Zustand/etc.)
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
bun test:unit                                  # run unit tests only
bun test:integration                           # run integration tests only
```

## Rules

- **Feature branches only** — never commit directly to `main`. Before starting any work, create or switch to a feature branch. Always `git pull --rebase origin main` before beginning work and before opening a PR.
- **Never `git push` directly** — always ask before pushing to any remote.
- **Conventional Commits** — `type(scope): description` (e.g. `feat(api): add auth endpoint`, `fix(tokens): correct color value`).
- **No AI attribution** — never add `Co-Authored-By` or any Claude/AI mention in commit messages.
- **Bun only** — never use npm, pnpm, yarn, or npx. Use `bun` and `bunx`.
- **Pinned versions** — no `^` or `~` prefixes in `package.json` dependencies.

## Conventions

- CSS vars from `@tmonier/tokens` — design tokens are the single source of truth
- **`@tmonier/tokens` for branding** — both UI and Landing import `@tmonier/tokens/tailwind.css` + `@tmonier/tokens/tokens.css` to enforce consistent branding
- Fonts loaded via `@fontsource/*` npm packages (self-hosted, imported in global.css via `@import`)
- Landing page deploys to **Cloudflare Pages** — output: `packages/landing/dist/`
- No `any` — strict TypeScript everywhere
- **Effect** for all backend business logic (no try/catch)
- **Valibot** for all schemas (no Zod)
- **Valibot for env validation** — environment variables validated with Valibot schemas (see `env.ts` patterns)
- **Biome** only (no ESLint/Prettier)
- **ESM only** — all packages use ESM. If a dependency requires CJS, stop and alert the user (find an ESM alternative or skip it)
- **Tailwind only** — no `style` attributes in UI/Landing (exception: CSS custom property usage in complex gradients). Never use CSS modules or `@apply`
- **`cn()` utility** — use `cn()` from `#shared/lib/cn` (ui) or `#lib/cn` (landing) for conditional Tailwind class merging via `tailwind-merge`
- **No barrel exports** — import from specific files, not `index.ts` re-exports
- **No shortcuts** — never use `// @ts-ignore`, `as any`, `biome-ignore` unless truly unavoidable. Never add entries to knip's ignore lists to hide unused code — fix the root cause instead
- **Self-documenting code** — minimal comments. Code should be self-explanatory. No JSDoc unless for public library APIs
- **Clean code** — no dead code, no commented-out code, no TODO comments without linked issues
- **Bun test runner** — `import { describe, expect, it } from 'bun:test'`
- **Effect logging only in `@tmonier/api`** — use `Effect.logInfo`, `Effect.logWarning`, `Effect.logError`, `Effect.logDebug` with `Effect.annotateLogs` for structured context. `console.log` is banned by Biome in the API package. Use `Logger.consolePretty()` layer for dev output.

## Subpath imports

All cross-folder imports must use ESM subpath aliases (`#alias/...`), never relative paths across root-level folders. Each alias is defined in both `package.json` `"imports"` and `tsconfig.json` `"paths"` (and Vite `resolve.alias` where applicable).

| Package | Aliases |
|---|---|
| `@tmonier/api` | `#modules/*`, `#routes/*` |
| `@tmonier/ui` | `#app/*`, `#shared/*`, `#entities/*`, `#features/*`, `#widgets/*`, `#pages/*`, `#routes/*` |
| `@tmonier/landing` | `#components/*`, `#layouts/*`, `#assets/*`, `#styles/*`, `#lib/*` |
| `@tmonier/shared` | `#contracts/*`, `#schemas/*` |
