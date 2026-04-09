# vigie

Local-first agent supervisor for software engineers. "Eyes on the horizon."
Real-time visibility into AI agent activity, drift detection, token cost guardrails, checkpoints & rollback. BYOA (Bring Your Own AI). Fully local — no remote servers, no cloud dependency.

vigie is built by **Tmonier SRL** (Damien Meur's freelance company). The freelance portfolio lives at `tmonier.com`; vigie lives at `vigie.tmonier.com`.

## Stack

- **Bun** everywhere — runtime, package manager, test runner, daemon compilation
- **Turborepo** monorepo with Bun workspaces
- **Biome** for lint + format (no ESLint, no Prettier) — config at root `biome.json`
- **TypeScript strict** across all packages, ESM only — **use `tsgo` (`@typescript/native-preview`) not `tsc`**

## Packages

| Package | Path | Key libraries |
|---|---|---|
| `@vigie/app` | `packages/app/` | Effect, @effect/platform-bun HTTP, React SSR, Bun PTY, xterm headless, SQLite, Vite (client islands) |
| `@vigie/tokens` | `packages/tokens/` | Design tokens — CSS + JS exports |
| `@vigie/landing` | `packages/landing/` | Astro 5 + Tailwind v4 (vigie product page) |
| `@vigie/video` | `packages/video/` | Remotion feature clips |

The freelance portfolio (`tmonier.com`) is a separate repo: `get-tmonier/landing`.

## Architecture

**Overall:** `Browser (SSR, localhost:19191) ↔ Effect HTTP+WS (embedded in daemon) ↔ AgentProcess (PTY) ↔ spawn(claude, aider, ...)`

**Single process, fully local:**
- **CLI daemon** (`@vigie/app`): single Bun process that runs everything
  - **Embedded Effect HTTP server** on `localhost:19191` — serves REST API + WebSocket + React SSR
  - **AgentProcess** — spawns and manages agent sessions via PTY (Claude, aider, codex, generic); `SessionOutput` streams live output to browser viewers; `SessionLog` persists terminal output to SQLite
  - **SQLite database** at `~/.vigie/data.db` — sessions, terminal chunks, input history
  - **Unix socket IPC** at `~/.vigie/daemon.sock` — CLI-to-daemon communication
  - Agent-agnostic design: `AgentSpec` port + `AgentCatalog` defines how to spawn any CLI agent
- **Frontend:** React SSR rendered by the daemon, with Vite-bundled client islands for interactivity
- **No auth required** — everything runs on localhost
- **No external database** — SQLite only
- **No remote servers** — no Railway, no PostgreSQL, no OAuth

### Communication

```
CLI commands → Unix socket IPC → Daemon
Browser      → HTTP/WebSocket  → Daemon (localhost:19191)
Daemon       → PTY spawn       → claude/aider/codex/...
```

- `GET /api/sessions` — list all sessions
- `POST /api/sessions` — spawn new agent session
- `POST /api/sessions/:id/kill` — kill session
- `POST /api/sessions/:id/resume` — resume session
- `DELETE /api/sessions/:id` — delete session
- `WS /ws/events` — real-time session lifecycle events
- `WS /ws/terminal/:sessionId` — terminal I/O for xterm.js

## Verify pipeline

Pre-commit runs `bun run verify` via simple-git-hooks:
```
knip → biome check → typecheck → test → build
```

## Commands

```bash
bun install                                    # install all dependencies
bun turbo dev                                  # daemon + ui on localhost:19191 (SSR)
bun run dev:landing                            # dev server for vigie landing
bun turbo build                                # build all packages
bun turbo check                                # biome check
bun turbo check -- --fix                       # biome check + fix
bun turbo typecheck                            # typescript check (also shows Effect LSP diagnostics for @vigie/app)
bun turbo test                                 # run tests
bun run verify                                 # full pipeline: knip → check → typecheck → test → build
bun run verify:fix                             # auto-fix then verify
bun turbo build --filter=@vigie/landing        # build single package
```

### CLI commands

```bash
vigie daemon start          # start daemon in background
vigie daemon start --fg     # start in foreground
vigie daemon stop           # stop daemon
vigie daemon status         # show daemon status
vigie open                  # open dashboard in browser
vigie claude                # run Claude Code (interactive)
vigie claude -p "..."       # run Claude Code with prompt
vigie session list          # list sessions
vigie session attach --id   # attach to active session
vigie session resume --id   # resume ended session
```

## Rules

- **Feature branches only** — never commit directly to `main`. Before starting any work, create or switch to a feature branch. Always `git pull --rebase origin main` before beginning work and before opening a PR.
- **Never `git push` directly** — always ask before pushing to any remote.
- **Conventional Commits** — `type(scope): description` (e.g. `feat(cli): add open command`, `fix(tokens): correct color value`).
- **No AI attribution** — never add `Co-Authored-By` or any Claude/AI mention in commit messages.
- **Bun only** — never use npm, pnpm, yarn, or npx. Use `bun` and `bunx`.
- **Pinned versions** — no `^` or `~` prefixes in `package.json` dependencies.
- **Lowercase brand** — always write "vigie" (lowercase), never "Vigie". The brand is always lowercase in all contexts (titles, prose, UI, docs).

## Conventions

- CSS vars from `@vigie/tokens` — design tokens are the single source of truth
- **`@vigie/tokens` for branding** — UI and Landing import `@vigie/tokens/tailwind.css` + `@vigie/tokens/tokens.css` to enforce consistent branding
- Fonts loaded via `@fontsource/*` npm packages (self-hosted, imported in global.css via `@import`)
- No `any` — strict TypeScript everywhere
- **Effect** for CLI daemon business logic (no try/catch)
- **Valibot** for all schemas (no Zod)
- **Valibot for env validation** — environment variables validated with Valibot schemas (see `env.ts` patterns)
- **Biome** only (no ESLint/Prettier)
- **ESM only** — all packages use ESM. If a dependency requires CJS, stop and alert the user (find an ESM alternative or skip it)
- **Tailwind only** — no `style` attributes in UI/Landing (exception: CSS custom property usage in complex gradients). Never use CSS modules or `@apply`
- **`cn()` utility** — use `cn()` from `#shared/lib/cn` (ui) or `#lib/cn` (landing) for conditional Tailwind class merging via `tailwind-merge`
- **No barrel exports** — import from specific files, not `index.ts` re-exports
- **No shortcuts** — never use `// @ts-ignore`, `as any`, `biome-ignore` unless truly unavoidable. Never add entries to knip's ignore lists to hide unused code — fix the root cause instead. When a type error occurs, find the correct type (e.g. `ReturnType<typeof fn>`, a concrete Effect type, or a proper interface) — never widen to `any` as a shortcut. Type casts like `as Effect.Effect<never, never, never>` are acceptable only when TypeScript inference breaks on well-understood Effect patterns.
- **Self-documenting code** — minimal comments. Code should be self-explanatory. No JSDoc unless for public library APIs
- **Clean code** — no dead code, no commented-out code, no TODO comments without linked issues
- **Bun test runner** — `import { describe, expect, it } from 'bun:test'`

## Subpath imports

All cross-folder imports must use ESM subpath aliases (`#alias/...`), never relative paths across root-level folders. Each alias is defined in both `package.json` `"imports"` and `tsconfig.json` `"paths"` (and Vite `resolve.alias` where applicable).

| Package | Aliases |
|---|---|
| `@vigie/app` | `#modules/*`, `#shared/*`, `#dependencies` |
| `@vigie/landing` | `#components/*`, `#layouts/*`, `#assets/*`, `#styles/*`, `#lib/*` |

## Multi-agent extensibility

The **domain layer and ports are agent-agnostic** — `AgentSpec` port, `AgentCatalog`, and the `Session` domain entity treat `agentType` as a plain string. Adding a new agent (e.g. opencode) requires changes only in the infrastructure layer:

| What to change | Location | Notes |
|---|---|---|
| CLI command | `src/modules/agent-session/infrastructure/adapters/in/commands/` | `vigie claude` is Claude-specific — add `vigie opencode` or generalize to `vigie run --agent <name>` |
| Prompt-mode runner | `src/modules/agent-session/infrastructure/adapters/out/agents/claude-runner.adapter.ts` | The only `AgentRunnerShape` impl — new agents need their own runner |
| Session resume | `src/modules/agent-session/infrastructure/adapters/in/commands/session-resume.command.ts` | Rejects non-Claude + hardcodes `~/.claude/` paths — use `AgentSpec.canResume` + `AgentSpec.isResumable` instead |
| IPC schema | `src/shell/infrastructure/adapters/ipc-schemas.ts` | `agentType` is a closed `picklist` — extend or change to `v.string()` |
| Agent adapter | `src/modules/agent-session/infrastructure/adapters/out/agents/` | One file per agent (e.g. `opencode.adapter.ts`), registered in `agent-catalog.ts` |
