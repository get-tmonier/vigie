# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 independent structural/hygiene issues found during codebase review — no new features, no behavior changes.

**Architecture:** Each task is fully independent. Run `bun run verify` (knip → biome → typecheck → test → build) after each task to confirm nothing broke. Commit after each task.

**Tech Stack:** Bun, TypeScript strict, Effect, Valibot, Biome, Turborepo monorepo

---

## File Map

| Task | Files touched |
|------|--------------|
| T1 | `packages/app/.github/` (delete), `packages/app/package.json` |
| T2 | `.gitignore` |
| T3 | `packages/app/src/shared/kernel/ipc-protocol.ts`, `packages/app/src/shared/kernel/CLAUDE.md` |
| T4 | `packages/app/src/modules/daemon/dependencies.ts`, `packages/app/src/modules/daemon/application/use-cases/run-daemon.use-case.ts` |
| T5 | `packages/app/src/infra/` (move to `shared/db/` + `shared/ssr/`), `packages/app/package.json`, `packages/app/tsconfig.json`, `packages/app/vite.config.ts`, 7 import sites |
| T6 | `packages/app/src/shared/kernel/contracts/` (new dir), `ipc-protocol.ts` (move), `cli-sender.port.ts` (move+rename), `agent-session/dependencies.ts`, `daemon/dependencies.ts`, 7 import sites, `shared/kernel/CLAUDE.md` |

---

### Task 1: Remove stale `packages/app/.github/` and fix check script

**Files:**
- Delete: `packages/app/.github/workflows/ci.yml`
- Delete: `packages/app/.github/workflows/`
- Delete: `packages/app/.github/`
- Modify: `packages/app/package.json`

Context: `packages/app/.github/` contains a CI workflow that GitHub silently ignores (GitHub only reads `.github/` at the repo root). The root CI is at `.github/workflows/ci.yml`. Additionally, `packages/app/package.json`'s `check` script only lints `./src` — `./scripts/` (which contains `check-imports.ts`, `fix-imports.ts`) is never linted.

- [ ] **Step 1: Delete the stale `.github/` folder**

```bash
rm -rf packages/app/.github
```

- [ ] **Step 2: Extend the check script in `packages/app/package.json`**

Find this line in `packages/app/package.json`:
```json
"check": "biome check ./src",
```
Replace with:
```json
"check": "biome check ./src ./scripts",
```

- [ ] **Step 3: Run verify**

```bash
bun run verify
```
Expected: all checks pass (knip, biome, typecheck, test, build).

- [ ] **Step 4: Commit**

```bash
git add packages/app/package.json
git commit -m "chore(ci): remove stale app/.github and lint scripts/ folder"
```

---

### Task 2: Stop versioning `docs/superpowers/`

**Files:**
- Modify: `.gitignore` (root)

Context: `docs/superpowers/` holds AI-generated brainstorming artifacts (specs, plans). They should be local-only — not versioned, but not deleted either.

- [ ] **Step 1: Add to `.gitignore`**

Append to root `.gitignore`:
```
# AI brainstorming artifacts (local only)
docs/superpowers/
```

- [ ] **Step 2: Untrack without deleting**

```bash
git rm --cached -r docs/superpowers/
```

Expected output: a series of `rm 'docs/superpowers/...'` lines.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: untrack docs/superpowers (local-only AI artifacts)"
```

---

### Task 3: `agentType` → `v.picklist(['claude'])`

**Files:**
- Modify: `packages/app/src/shared/kernel/ipc-protocol.ts`
- Modify: `packages/app/src/shared/kernel/CLAUDE.md`

Context: `agentType` in the IPC protocol is currently `v.string()`. Only `"claude"` is a valid value. Switching to `v.picklist(['claude'])` gives compile-time and parse-time type safety. When a new agent is added, extend the picklist.

- [ ] **Step 1: Update `ipc-protocol.ts` — two occurrences**

In `SessionRegisterSchema`, change:
```typescript
agentType: v.string(),
```
to:
```typescript
agentType: v.picklist(['claude']),
```

In `SessionSpawnInteractiveSchema`, change:
```typescript
agentType: v.string(),
```
to:
```typescript
agentType: v.picklist(['claude']),
```

- [ ] **Step 2: Update `CLAUDE.md`**

Replace the `## agentType convention` section in `packages/app/src/shared/kernel/CLAUDE.md`:

```markdown
## agentType convention

`agentType` in IPC schemas is typed as `v.picklist(['claude'])`. When adding a new agent,
extend the picklist: `v.picklist(['claude', 'opencode'])`. New agents also require an
`AgentAdapter` in `agent-session/infrastructure/adapters/out/agents/` registered in `agent-registry.ts`.
```

- [ ] **Step 3: Run verify**

```bash
bun run verify
```
Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/shared/kernel/ipc-protocol.ts packages/app/src/shared/kernel/CLAUDE.md
git commit -m "feat(kernel): narrow agentType to v.picklist(['claude'])"
```

---

### Task 4: Cleanup filenames — read from `DaemonConfig`

**Files:**
- Modify: `packages/app/src/modules/daemon/dependencies.ts`
- Modify: `packages/app/src/modules/daemon/application/use-cases/run-daemon.use-case.ts`

Context: `cleanup()` in `dependencies.ts` hardcodes `['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']`. `DaemonConfigShape` already has `pidFile`, `socketPath`, `stdinSocketPath`, `portFile` with the correct full paths. The fix: pass `DaemonConfigShape` into `cleanup()` and read paths from it. `run-daemon.use-case.ts` already has `const config = yield* DaemonConfig` and calls `cleanup()` in two places.

- [ ] **Step 1: Update `cleanup()` in `dependencies.ts`**

Replace the existing `cleanup` function and its imports with:

```typescript
import { unlinkSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { CliSender } from '#modules/agent-session/application/ports/out/cli-sender.port';
import { AgentSession } from '#modules/agent-session/dependencies';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createRunDaemon } from '#modules/daemon/application/use-cases/run-daemon.use-case';
import { UnixSocketServerLive } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import type { DaemonConfigShape } from '#modules/daemon/infrastructure/daemon-config';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';

export function cleanup(config: DaemonConfigShape): void {
  for (const filePath of [config.pidFile, config.socketPath, config.stdinSocketPath, config.portFile]) {
    try {
      unlinkSync(filePath);
    } catch {}
  }
}
```

Note: remove the `homedir`, `join` imports and `const _HOME` — they are no longer needed.

- [ ] **Step 2: Update `RunDaemonDeps` and `cleanup` call sites in `run-daemon.use-case.ts`**

Change the `cleanup` field in `RunDaemonDeps`:
```typescript
// Before
cleanup: () => void;
// After
cleanup: (config: DaemonConfigShape) => void;
```

Add the import at the top:
```typescript
import type { DaemonConfigShape } from '#modules/daemon/infrastructure/daemon-config';
```

Update both `cleanup()` call sites (in `addFinalizer` and in `catchDefect`) to pass config:
```typescript
cleanup(config);
```

- [ ] **Step 3: Run verify**

```bash
bun run verify
```
Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/modules/daemon/dependencies.ts packages/app/src/modules/daemon/application/use-cases/run-daemon.use-case.ts
git commit -m "refactor(daemon): derive cleanup paths from DaemonConfig"
```

---

### Task 5: Split `src/infra/` into `src/shared/db/` and `src/shared/ssr/`

**Files:**
- Move: `src/infra/database.ts` → `src/shared/db/database.ts`
- Move: `src/infra/ssr/client-entry.tsx` → `src/shared/ssr/client-entry.tsx`
- Move: `src/infra/ssr/document.tsx` → `src/shared/ssr/document.tsx`
- Move: `src/infra/ssr/render-page.tsx` → `src/shared/ssr/render-page.tsx`
- Delete: `src/infra/`
- Modify: `packages/app/package.json` (imports)
- Modify: `packages/app/tsconfig.json` (paths)
- Modify: `packages/app/vite.config.ts` (alias + rollupOptions input)
- Update imports in 7 files (listed below)

Context: `src/infra/` is a transversal folder that should live under the existing `src/shared/`. Moving it there makes `src/shared/` the single home for all cross-cutting concerns.

The alias `#infra/*` maps to `./src/infra/*`. It will be split into `#shared/db/*` and `#shared/ssr/*`, both subsumed under the existing `#shared/*` alias (`./src/shared/*`). No new alias entries needed in `package.json` or `tsconfig.json` — existing `#shared/*` covers them.

- [ ] **Step 1: Create destination directories and move files**

```bash
mkdir -p packages/app/src/shared/db packages/app/src/shared/ssr
cp packages/app/src/infra/database.ts packages/app/src/shared/db/database.ts
cp packages/app/src/infra/ssr/client-entry.tsx packages/app/src/shared/ssr/client-entry.tsx
cp packages/app/src/infra/ssr/document.tsx packages/app/src/shared/ssr/document.tsx
cp packages/app/src/infra/ssr/render-page.tsx packages/app/src/shared/ssr/render-page.tsx
rm -rf packages/app/src/infra
```

- [ ] **Step 2: Remove `#infra/*` from `packages/app/package.json`**

In `packages/app/package.json`, remove:
```json
"#infra/*": "./src/infra/*",
```

- [ ] **Step 3: Remove `#infra/*` from `packages/app/tsconfig.json`**

In `packages/app/tsconfig.json`, remove:
```json
"#infra/*": ["./src/infra/*"],
```

- [ ] **Step 4: Update `packages/app/vite.config.ts`**

Change the `rollupOptions.input` path:
```typescript
// Before
input: { entry: resolve(__dirname, 'src/infra/ssr/client-entry.tsx') },
// After
input: { entry: resolve(__dirname, 'src/shared/ssr/client-entry.tsx') },
```

Change the `resolve.alias` entry:
```typescript
// Before
'#infra': resolve(__dirname, 'src/infra'),
// After
'#shared/db': resolve(__dirname, 'src/shared/db'),
'#shared/ssr': resolve(__dirname, 'src/shared/ssr'),
```

- [ ] **Step 5: Update imports — `#infra/database` → `#shared/db/database`**

Update these 5 files (change `#infra/database` → `#shared/db/database`):
- `packages/app/src/dependencies.ts`
- `packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-session-repository.integration.test.ts`
- `packages/app/src/modules/agent-session/infrastructure/adapters/out/__tests__/sqlite-terminal-repository.integration.test.ts`
- `packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts`
- `packages/app/src/modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts`

In each file, change:
```typescript
import { ... } from '#infra/database';
// or
import { ... } from '#infra/database';
```
to:
```typescript
import { ... } from '#shared/db/database';
```

Also update `run-daemon.use-case.ts`:
```typescript
// Before
import { VigiDatabase } from '#infra/database';
// After
import { VigiDatabase } from '#shared/db/database';
```

- [ ] **Step 6: Update import — `#infra/ssr/render-page` → `#shared/ssr/render-page`**

In `packages/app/src/modules/agent-session/infrastructure/adapters/in/session.routes.tsx`:
```typescript
// Before
import { renderPage } from '#infra/ssr/render-page';
// After
import { renderPage } from '#shared/ssr/render-page';
```

- [ ] **Step 7: Run verify**

```bash
bun run verify
```
Expected: all checks pass.

- [ ] **Step 8: Commit**

```bash
git add -A packages/app/
git commit -m "refactor(app): split src/infra into shared/db and shared/ssr"
```

---

### Task 6: Move `ipc-protocol` and `CliSender` to `shared/kernel/contracts/`

**Files:**
- Create dir: `packages/app/src/shared/kernel/contracts/`
- Move: `shared/kernel/ipc-protocol.ts` → `shared/kernel/contracts/ipc-protocol.ts`
- Move: `agent-session/application/ports/out/cli-sender.port.ts` → `shared/kernel/contracts/cli-sender.ts`
- Delete: `agent-session/application/ports/out/cli-sender.port.ts`
- Update imports in: `daemon/dependencies.ts`, `agent-session/dependencies.ts`, `daemon/application/ports/in/ipc-client.port.ts`, `daemon/application/ports/out/ipc-server.port.ts`, `daemon/infrastructure/adapters/__tests__/ipc-messages.unit.test.ts`, `daemon/infrastructure/adapters/__tests__/schemas.unit.test.ts`, `daemon/infrastructure/adapters/in/ipc-router.ts`, `daemon/infrastructure/adapters/in/unix-socket-client.adapter.ts`, `daemon/infrastructure/adapters/out/unix-socket-server.adapter.ts`
- Modify: `packages/app/src/shared/kernel/CLAUDE.md`

Context: `CliSender` is a cross-module contract (daemon provides the implementation, agent-session owns the port). `ipc-protocol.ts` is also a cross-module contract. Both belong in `shared/kernel/contracts/`. The `#shared/kernel/*` alias already covers `shared/kernel/contracts/*` — no alias changes needed. The `.port` suffix is dropped from `cli-sender.ts` since the `contracts/` folder makes the role clear.

- [ ] **Step 1: Create `contracts/` directory and move files**

```bash
mkdir -p packages/app/src/shared/kernel/contracts
cp packages/app/src/shared/kernel/ipc-protocol.ts packages/app/src/shared/kernel/contracts/ipc-protocol.ts
cp packages/app/src/modules/agent-session/application/ports/out/cli-sender.port.ts packages/app/src/shared/kernel/contracts/cli-sender.ts
rm packages/app/src/shared/kernel/ipc-protocol.ts
rm packages/app/src/modules/agent-session/application/ports/out/cli-sender.port.ts
```

- [ ] **Step 2: Update `CliSender` imports (2 files)**

In `packages/app/src/modules/daemon/dependencies.ts`:
```typescript
// Before
import { CliSender } from '#modules/agent-session/application/ports/out/cli-sender.port';
// After
import { CliSender } from '#shared/kernel/contracts/cli-sender';
```

In `packages/app/src/modules/agent-session/dependencies.ts`:
```typescript
// Before
import { CliSender } from '#modules/agent-session/application/ports/out/cli-sender.port';
// After
import { CliSender } from '#shared/kernel/contracts/cli-sender';
```

- [ ] **Step 3: Update `ipc-protocol` imports (7 files)**

Change `from '#shared/kernel/ipc-protocol'` → `from '#shared/kernel/contracts/ipc-protocol'` in each of these files:
- `packages/app/src/modules/daemon/application/ports/in/ipc-client.port.ts`
- `packages/app/src/modules/daemon/application/ports/out/ipc-server.port.ts`
- `packages/app/src/modules/daemon/infrastructure/adapters/__tests__/ipc-messages.unit.test.ts`
- `packages/app/src/modules/daemon/infrastructure/adapters/__tests__/schemas.unit.test.ts`
- `packages/app/src/modules/daemon/infrastructure/adapters/in/ipc-router.ts`
- `packages/app/src/modules/daemon/infrastructure/adapters/in/unix-socket-client.adapter.ts`
- `packages/app/src/modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter.ts`

- [ ] **Step 4: Update `shared/kernel/CLAUDE.md`**

Replace the full content of `packages/app/src/shared/kernel/CLAUDE.md` with:

```markdown
# shared/kernel

Cross-cutting wire protocols owned by no single bounded context.

## What belongs here

- `contracts/` — inter-module contracts: IPC message schemas and cross-module Effect service ports
- `errors.ts` — tagged errors used across module boundaries (e.g. `AgentRunnerError`)

## contracts/

- `ipc-protocol.ts` — Valibot schemas for the Unix socket protocol (Session ↔ Daemon). Two union types: `SessionToDaemon` (messages from CLI runner to daemon) and `DaemonToSession` (messages from daemon to CLI runner).
- `cli-sender.ts` — Effect `ServiceMap.Service` port for sending messages from agent-session use cases back to a connected CLI client. Implemented by the daemon layer at the composition root (`daemon/dependencies.ts`) — intentional dependency inversion.

## agentType convention

`agentType` in IPC schemas is typed as `v.picklist(['claude'])`. When adding a new agent,
extend the picklist: `v.picklist(['claude', 'opencode'])`. New agents also require an
`AgentAdapter` in `agent-session/infrastructure/adapters/out/agents/` registered in `agent-registry.ts`.

## What does NOT belong here

If something moves here to escape an import error, that is a boundary smell — fix the module design instead.
```

- [ ] **Step 5: Run verify**

```bash
bun run verify
```
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add -A packages/app/src/shared/kernel/contracts packages/app/src/shared/kernel/CLAUDE.md packages/app/src/modules/agent-session/dependencies.ts packages/app/src/modules/agent-session/application/ports packages/app/src/modules/daemon/
git commit -m "refactor(kernel): move ipc-protocol and CliSender to shared/kernel/contracts"
```
