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

```
Browser ↔ TanStack Start (SSR) ↔ Hono + Effect (API/WS) ↔ WebSocket ↔ CLI daemon (local) ↔ spawn(git, claude…)
```

| Layer | Description | Deployment |
|---|---|---|
| **App** | TanStack Start SSR | `app.vigie.tmonier.com` |
| **API** | Hono + Effect + PostgreSQL | `api.vigie.tmonier.com` |
| **CLI** | Local Bun binary (`@vigie/cli`) | Your machine |

## Monorepo

| Package | Path | Stack |
|---|---|---|
| `@vigie/api` | `packages/api/` | Hono, Effect, Kysely, PostgreSQL |
| `@vigie/ui` | `packages/ui/` | React, TanStack Start/Router |
| `@vigie/cli` | `packages/cli/` | Effect, Bun PTY, xterm headless |
| `@vigie/shared` | `packages/shared/` | ts-rest, Valibot |
| `@vigie/tokens` | `packages/tokens/` | Design tokens (CSS + JS) |
| `@vigie/landing` | `packages/landing/` | Astro 5, Tailwind v4 |

## Tech stack

Bun · Turborepo · Biome · TypeScript strict · ESM only

## Getting started

```bash
bun install            # install all dependencies
bun turbo dev          # dev servers (api + ui)
bun turbo build        # build all packages
bun turbo test         # run tests
```

## Verify pipeline

```bash
bun run verify         # knip → biome check → typecheck → test → build
bun run verify:fix     # auto-fix then verify
```

Runs automatically on pre-commit via `simple-git-hooks`.

## Contributing

Feature branches only — never commit directly to `main`. Conventional Commits (`type(scope): description`).

## License

[MIT](./LICENSE) — Built by [Tmonier SRL](https://tmonier.com).
