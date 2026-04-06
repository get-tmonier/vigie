<p align="center">
  <img src="packages/tokens/assets/radar.svg" alt="vigie" width="80" />
</p>

<h1 align="center">vigie</h1>

<p align="center">
  <strong>Open-source AI agent supervision for engineers who ship.</strong><br/>
  <em>Eyes on the horizon.</em>
</p>

<p align="center">
  <a href="https://github.com/get-tmonier/vigie/actions/workflows/ci.yml"><img src="https://github.com/get-tmonier/vigie/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/get-tmonier/vigie/blob/main/LICENSE"><img src="https://img.shields.io/github/license/get-tmonier/vigie" alt="License" /></a>
  <a href="https://vigie.tmonier.com"><img src="https://img.shields.io/badge/website-vigie.tmonier.com-178A6A" alt="Website" /></a>
</p>

<p align="center">
  Real-time visibility, drift detection, cost guardrails, checkpoints & rollback.<br/>
  Local-first. BYOA (Bring Your Own AI).
</p>

<p align="center">
  <br/>
  <a href="https://vigie.tmonier.com/#in-action"><strong>Watch it in action on vigie.tmonier.com &rarr;</strong></a><br/>
  <sub>8 feature clips. No signup. See loop detection, scope drift, cost guardrails, checkpoints & pair programming — all in motion.</sub>
</p>

---

## Architecture

Fully local — single process, no remote servers, no cloud dependency.

```
Browser (SSR, localhost:19191) <-> Effect HTTP+WS (embedded in daemon) <-> PTY manager <-> spawn(claude, aider, ...)
```

| Component | Description |
|---|---|
| **CLI daemon** | Single Bun process — embedded HTTP server, PTY manager, SQLite |
| **Dashboard** | React SSR rendered by the daemon at `localhost:19191` |
| **Agents** | Claude Code, aider, codex, or any CLI tool — spawned via PTY |

## Monorepo

| Package | Path | Stack |
|---|---|---|
| `@vigie/app` | `packages/app/` | Effect, @effect/platform-bun, React SSR, Bun PTY, xterm headless, SQLite |
| `@vigie/tokens` | `packages/tokens/` | Design tokens (CSS + JS) |
| `@vigie/landing` | `packages/landing/` | Astro 5, Tailwind v4 |
| `@vigie/video` | `packages/video/` | Remotion feature clips |

## Tech stack

Bun · Turborepo · Biome · TypeScript strict · ESM only

## Getting started

```bash
bun install            # install all dependencies
bun turbo dev          # daemon + ui on localhost:19191 (SSR)
bun turbo build        # build all packages
bun turbo test         # run tests
```

## CLI

```bash
vigie daemon start          # start daemon in background
vigie daemon start --fg     # start in foreground
vigie daemon stop           # stop daemon
vigie open                  # open dashboard in browser
vigie claude                # run Claude Code (interactive)
vigie claude -p "..."       # run Claude Code with prompt
vigie session list          # list sessions
vigie session attach --id   # attach to active session
vigie session resume --id   # resume ended session
```

## Verify pipeline

```bash
bun run verify         # knip -> biome check -> typecheck -> test -> build
bun run verify:fix     # auto-fix then verify
```

Runs automatically on pre-commit via `simple-git-hooks`.

## Contributing

Feature branches only — never commit directly to `main`. Conventional Commits (`type(scope): description`).

## License

[MIT](./LICENSE) — Built by [Tmonier SRL](https://tmonier.com).
