# Consolidate src/lib into src/shared/lib Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `src/lib/` into `src/shared/lib/` to eliminate the structural duplication between the two `lib` directories.

**Architecture:** Move all files from `src/lib/` to `src/shared/lib/`, update all `#lib/` imports to `#shared/lib/`, remove the `#lib/*` alias from all three config files (package.json, tsconfig.json, vite.config.ts), then delete the empty `src/lib/` directory.

**Tech Stack:** Bun, TypeScript, Effect, Vite

---

### Task 1: Move files from src/lib to src/shared/lib

**Files:**
- Move: `src/lib/agent-runner.ts` → `src/shared/lib/agent-runner.ts`
- Move: `src/lib/input-line-buffer.ts` → `src/shared/lib/input-line-buffer.ts`
- Move: `src/lib/git-context.ts` → `src/shared/lib/git-context.ts`
- Move: `src/lib/cli-terminal/` → `src/shared/lib/cli-terminal/`
- Move: `src/lib/vterm/` → `src/shared/lib/vterm/`

- [ ] **Step 1: Move root-level lib files**

```bash
cp packages/app/src/lib/agent-runner.ts packages/app/src/shared/lib/agent-runner.ts
cp packages/app/src/lib/input-line-buffer.ts packages/app/src/shared/lib/input-line-buffer.ts
cp packages/app/src/lib/git-context.ts packages/app/src/shared/lib/git-context.ts
```

- [ ] **Step 2: Move cli-terminal directory**

```bash
cp -r packages/app/src/lib/cli-terminal packages/app/src/shared/lib/cli-terminal
```

- [ ] **Step 3: Move vterm directory**

```bash
cp -r packages/app/src/lib/vterm packages/app/src/shared/lib/vterm
```

---

### Task 2: Update all #lib/ imports to #shared/lib/

**Files to modify (9 files, 18 occurrences):**
- `src/shared/lib/cli-terminal/chunk-printer.ts` (was `src/lib/…`)
- `src/shared/lib/cli-terminal/status-bar-live.ts` (was `src/lib/…`)
- `src/modules/agent-session/application/use-cases/terminal-connection.use-case.ts`
- `src/modules/daemon/infrastructure/adapters/in/pty-relay.ts`
- `src/modules/daemon/infrastructure/adapters/in/commands/claude-interactive.command.ts`
- `src/modules/daemon/infrastructure/adapters/in/commands/claude.command.ts`
- `src/modules/daemon/infrastructure/adapters/in/commands/session-resume.command.ts`
- `src/modules/daemon/infrastructure/adapters/in/commands/session-attach.command.ts`
- `src/modules/daemon/infrastructure/adapters/out/agents/claude-runner.adapter.ts`

- [ ] **Step 1: Replace all #lib/ with #shared/lib/ across src/**

```bash
find packages/app/src -type f -name '*.ts' -o -name '*.tsx' | xargs sed -i '' "s|'#lib/|'#shared/lib/|g"
```

- [ ] **Step 2: Verify no #lib/ imports remain**

```bash
grep -r "#lib/" packages/app/src
```
Expected: no output

---

### Task 3: Remove #lib/* alias from config files

**Files:**
- Modify: `packages/app/package.json`
- Modify: `packages/app/tsconfig.json`
- Modify: `packages/app/vite.config.ts`

- [ ] **Step 1: Remove from package.json**

In `packages/app/package.json`, remove:
```json
"#lib/*": "./src/lib/*",
```

- [ ] **Step 2: Remove from tsconfig.json**

In `packages/app/tsconfig.json`, remove:
```json
"#lib/*": ["./src/lib/*"],
```

- [ ] **Step 3: Remove from vite.config.ts**

In `packages/app/vite.config.ts`, remove:
```ts
'#lib': resolve(__dirname, 'src/lib'),
```

---

### Task 4: Delete src/lib directory and verify

- [ ] **Step 1: Delete the now-empty src/lib directory**

```bash
rm -rf packages/app/src/lib
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: no errors

- [ ] **Step 3: Run verify**

```bash
bun run verify
```
Expected: knip → biome → typecheck → test → build all pass

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/shared/lib packages/app/src/lib packages/app/package.json packages/app/tsconfig.json packages/app/vite.config.ts packages/app/src/modules
git commit -m "refactor(app): consolidate src/lib into src/shared/lib"
```
