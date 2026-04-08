# ADR 003: Effect.Layer for Dependency Injection

**Status:** Accepted  
**Date:** 2026-04-08

## Context

vigie's daemon coordinates multiple concerns: HTTP server, WebSocket broadcast, PTY registry, SQLite connection pool, IPC server, session registry, and event publishing. Each module exposes ports (interfaces) that must be wired at the composition root.

Manual DI (constructor injection, factories) quickly becomes unwieldy. A heavy DI container introduces runtime reflection overhead. Effect.Layer provides compile-time dependency safety with the simplicity of functional composition.

## Decision

All infrastructure is modeled as `Effect.Layer`. Use cases are factory functions that request services via `Effect.gen` or `Effect.service`. The root `src/dependencies.ts` composes all layers, creating a type-safe dependency graph.

## Consequences

**Advantages:**
- Compile-time safety: missing a dependency is a type error
- Lazy: layers are only initialized when actually used
- Composable: layers can be combined, tested with substitutes, or reordered
- Local reasoning: each module's `dependencies.ts` exports its own layers; the root composes them
- Effect-native: no external DI library; uses the same abstraction as error handling and cancellation

**Trade-offs:**
- Steep learning curve: Effect.Layer requires understanding Effect monadic style
- Error messages can be verbose (Effect reports full type context on mismatch)
- Debugging instantiation order requires Effect knowledge

**Best practices enforced:**
- Only `dependencies.ts` wires across module boundaries
- No runtime container discovery; all wiring is explicit code
- Tests substitute layers for mocks (no runtime magic)

**Future implications:**
- Feature flags or runtime config can be modeled as Layer inputs
- Distributed or multi-process architectures would require rethinking the composition strategy (Effect does not cross process boundaries)
