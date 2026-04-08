# Module Boundary Rules

- No cross-module imports. `modules/X` must not import from `modules/Y`.
- Only `modules/*/dependencies.ts` may wire across module boundaries.
- Only UI islands (`modules/*/infrastructure/adapters/in/ui/`) may compose across modules.
- Shared kernel (`#shared/kernel/`) is for cross-cutting wire protocols owned by no single bounded context.
  - If something moves to shared/kernel to escape an import error, that is a boundary smell — fix the module design instead.
- Each module owns its `CLAUDE.md`, `dependencies.ts`, and domain layer.
- `src/dependencies.ts` (root) is the only file allowed to import from multiple modules simultaneously.
