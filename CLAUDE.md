# Tmonier Monorepo

Monorepo for [tmonier.com](https://tmonier.com) — a local-first SWE companion.

## Stack
- **Turborepo** monorepo with **Bun** workspaces
- **Bun** as runtime and package manager
- **Biome** for lint/format (no ESLint, no Prettier) — config at root `biome.json`
- **TypeScript strict** across all packages

## Packages
| Package | Path | Description |
|---|---|---|
| `@tmonier/tokens` | `packages/tokens/` | Design tokens (colors, fonts) — CSS + JS exports |
| `@tmonier/landing` | `packages/landing/` | Marketing site (Astro 5 + Tailwind v4, Cloudflare Pages) |
| `@tmonier/ui` | `packages/ui/` | Shared UI components (placeholder) |
| `@tmonier/api` | `packages/api/` | API server (placeholder) |
| `@tmonier/shared` | `packages/shared/` | Shared utilities (placeholder) |

## Commands
```bash
bun install            # install all dependencies
bun turbo build        # build all packages
bun turbo dev          # dev servers (all packages)
bun turbo check        # biome check all packages
bun turbo build --filter=@tmonier/landing   # build only landing
bun --filter @tmonier/landing dev           # dev server for landing only
```

## Key conventions
- All styling uses inline `style` attributes with CSS vars from `@tmonier/tokens`
- Design tokens are the single source of truth in `packages/tokens/`
- Google Fonts loaded via `<link>` tags (not `@import` in CSS)
- Landing page deploys to **Cloudflare Pages** — output: `packages/landing/dist/`

## Rules
- **Never `git push` directly** — always ask before pushing to any remote.
- **Conventional Commits** — all commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) spec: `type(scope): description` (e.g. `feat(landing): add hero section`, `fix(tokens): correct color value`).
- **No co-author attribution** — never add `Co-Authored-By` or any Claude/AI mention in commit messages.
