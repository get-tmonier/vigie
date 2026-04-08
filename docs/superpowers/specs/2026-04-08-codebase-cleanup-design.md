# Codebase Cleanup — Design Spec

**Date:** 2026-04-08  
**Branch:** fix/server-not-starting (or a dedicated cleanup branch)

## Overview

Six independent housekeeping items identified during a codebase review. No new features — each item removes dead code, fixes a structural inconsistency, or improves type safety.

---

## 1. Remove stale `packages/app/.github/`

**Problem:** A `.github/workflows/ci.yml` exists inside `packages/app/`. GitHub Actions only reads `.github/` from the repository root — this file is silently ignored and drifts out of sync.

**Additionally:** `packages/app/package.json` `check` script runs `biome check ./src` only — `packages/app/scripts/` (containing `check-imports.ts`, `fix-imports.ts`) is not linted anywhere.

**Fix:**
- Delete `packages/app/.github/` entirely
- Update `packages/app/package.json` `check` script: `biome check ./src` → `biome check ./src ./scripts`

---

## 2. Stop versioning `docs/superpowers/`

**Problem:** `docs/superpowers/` (specs + plans, ~158 KB) is tracked by git. These are AI-generated brainstorming artifacts — not source code, not project documentation meant for contributors.

**Fix:**
- Add `docs/superpowers/` to root `.gitignore`
- Run `git rm --cached -r docs/superpowers/` to untrack without deleting local files

---

## 3. `agentType` → `v.picklist(['claude'])`

**Problem:** `agentType` in `shared/kernel/ipc-protocol.ts` is `v.string()` — no type safety. Only `"claude"` is a valid value today.

**Fix:**
- Replace both `v.string()` occurrences (`SessionRegisterSchema`, `SessionSpawnInteractiveSchema`) with `v.picklist(['claude'])`
- Update `shared/kernel/CLAUDE.md` to note the picklist pattern and that new agents extend it

---

## 4. Cleanup filenames — read from `DaemonConfig`

**Problem:** `packages/app/src/modules/daemon/dependencies.ts` hardcodes `['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']` in a cleanup loop. `daemon-config.ts` already defines these as named properties (`pidFile`, `socketPath`, `stdinSocketPath`, `portFile`).

**Fix:**
- In `dependencies.ts`, read the cleanup paths from the `DaemonConfig` instance instead of the hardcoded array

---

## 5. Split `src/infra/` into `src/shared/db/` and `src/shared/ssr/`

**Problem:** `src/infra/` is a catch-all for cross-cutting infrastructure (`database.ts`, `ssr/`). Everything else transversal already lives in `src/shared/`.

**Fix:**
- Move `src/infra/database.ts` → `src/shared/db/database.ts`
- Move `src/infra/ssr/` → `src/shared/ssr/`
- Delete `src/infra/`
- Update subpath aliases in `package.json` `"imports"` and `tsconfig.json` `"paths"`:
  - `#infra/database` → `#shared/db/database`
  - `#infra/ssr/*` → `#shared/ssr/*`
- Update all import sites
- Update Vite `resolve.alias` if applicable

---

## 6. Move `CliSender` + `ipc-protocol` to `shared/kernel/contracts/`

**Problem:**
- `CliSender` port is defined in `agent-session/application/ports/out/` but it is a cross-module contract (daemon provides the implementation). Its location in `agent-session` is misleading.
- `ipc-protocol.ts` lives directly in `shared/kernel/` with no grouping.
- Both are inter-module contracts and belong together.

**Fix:**
- Create `src/shared/kernel/contracts/`
- Move `shared/kernel/ipc-protocol.ts` → `shared/kernel/contracts/ipc-protocol.ts`
- Move `agent-session/application/ports/out/cli-sender.port.ts` → `shared/kernel/contracts/cli-sender.ts` (drop `.port` suffix — context makes it clear)
- Update all import sites
- Update `shared/kernel/CLAUDE.md` to document the `contracts/` subfolder

**Note:** `shared/kernel/errors.ts` stays — it is a utility, not a cross-module contract.

---

## Constraints

- All 6 items are independent — can be executed in any order or in parallel
- No behavior changes — purely structural / type-safety improvements
- Full verify pipeline (`knip → biome → typecheck → test → build`) must pass after each item
