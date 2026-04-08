# agent-session boundary cleanup

**Date:** 2026-04-08  
**Branch:** refacto/effectifyremaining  
**Scope:** `packages/app/src/modules/agent-session`

## Problem

Two boundary violations in the `agent-session` module:

1. **`out→in` import**: `infrastructure/adapters/out/event-publisher.adapter.ts` imports `BrowserEvent` from `infrastructure/adapters/in/browser-events.ts`. An out adapter must never import from an in adapter.

2. **Dual responsibility**: `AppEventPublisher` (the concrete event publisher) implements both the `EventPublisher` OUT port (publish/subscribe domain events) and `subscribeBrowser` (serve browser WS subscriptions). These are two distinct concerns at different architectural layers.

3. **Loose `agentType` validation at HTTP boundary**: `SpawnSessionRequestSchema` accepts `agentType: v.string()` — any string passes validation, while the WS schema already enforces `v.picklist(['claude', 'opencode', 'generic'])`.

4. **Out of scope / backlog**: terminal events (`TerminalOutputEvent`, `TerminalInputEchoEvent`, `TerminalResizedEvent`) live in `domain/events.ts` but are PTY/infra events, not domain aggregate events. Separating them requires a port signature change and is tracked separately.

## Solution

Introduce an `EventFeed` OUT port so that the browser event concern has a proper home in the application layer. Port names follow the application's perspective, not the adapter's technology. Split `AppEventPublisher` into two single-responsibility adapters.

## Naming rationale

The port is named `EventFeed` — it describes what the application provides (a subscribable feed of events) without encoding the consumer technology (browser). The event type stays `BrowserEvent` because it IS a browser WebSocket wire format — it is honest about what it is.

## Architecture

```
application/ports/out/
  event-publisher.port.ts     (unchanged)
  event-feed.port.ts          (NEW — EventFeed port + BrowserEvent type)

infrastructure/adapters/out/
  event-publisher.adapter.ts  (simplified)
  event-feed.adapter.ts       (NEW)

infrastructure/adapters/in/
  browser-events.ts           (DELETED)
  session.routes.tsx          (updated — depends on port)

agent-session/dependencies.ts (updated — wires new adapter)
```

### Data flow

```
Before:
  publish(DomainEvent)
    → event-publisher.adapter
        ├─ domain listeners
        ├─ domainEventToBrowserEvent()   ← imports BrowserEvent from in/
        └─ browser listeners

After:
  publish(DomainEvent)
    → event-publisher.adapter
        └─ domain listeners
    → event-feed.adapter   (subscribed to EventPublisher)
        ├─ domainEventToBrowserEvent()  ← BrowserEvent defined in port
        └─ browser listeners
```

## Components

### `application/ports/out/event-feed.port.ts` (new)

Defines the wire format for browser WebSocket events and the subscription interface.

```ts
export type BrowserEvent = /* tagged union — moved verbatim from browser-events.ts */

export interface EventFeedShape {
  subscribe(listener: (event: BrowserEvent) => void): () => void;
}

export class EventFeed
  extends ServiceMap.Service<EventFeed, EventFeedShape>()(
    '@vigie/EventFeed'
  ) {}
```

`BrowserEvent` is the complete tagged union currently in `infrastructure/adapters/in/browser-events.ts`. It moves here unchanged — this is its canonical definition.

### `infrastructure/adapters/out/event-feed.adapter.ts` (new)

Subscribes to the `EventPublisher` domain stream, transforms events, and dispatches to feed listeners.

- On `Layer` init: calls `EventPublisher.subscribe(listener)` to wire up the domain stream
- Holds `domainEventToBrowserEvent(event: DomainEvent): BrowserEvent | null` (moved from `event-publisher.adapter.ts`)
- Per-listener errors caught with `Effect.catch → Effect.logError` (same pattern as today)
- Exports `EventFeedLive: Layer<EventFeed, never, EventPublisher>`

### `infrastructure/adapters/out/event-publisher.adapter.ts` (simplified)

Implements only `EventPublisher`: `publish(DomainEvent)` and `subscribe(listener)`.

- `AppEventPublisher` type removed
- `subscribeBrowser` removed
- `BrowserEvent` import removed
- `EventPublisherLive` layer structure unchanged

### `infrastructure/adapters/in/session.routes.tsx` (updated)

```ts
// Before
type SessionRouteDeps = {
  eventPublisher: { subscribeBrowser: (listener: (event: unknown) => void) => () => void };
  ...
};

// After
import type { EventFeedShape } from
  '#modules/agent-session/application/ports/out/event-feed.port';

type SessionRouteDeps = {
  eventFeed: EventFeedShape;
  ...
};
```

### `infrastructure/adapters/in/session.dto.ts` (updated)

```ts
export const SpawnSessionRequestSchema = v.object({
  agentType: v.optional(v.picklist(['claude', 'opencode', 'generic'])),
  cwd: v.optional(v.string()),
  cols: v.optional(v.number()),
  rows: v.optional(v.number()),
});
```

Domain (`session.ts`) keeps `type AgentType = string` — agent-agnostic per architecture principle.  
No shared constant across modules — `daemon/ws-schemas.ts` and `agent-session/session.dto.ts` each define the picklist independently (adding a new agent requires touching both anyway).

### `agent-session/dependencies.ts` (updated)

Wire `EventFeedLive` alongside `EventPublisherLive`:

```ts
EventFeedLive  // Layer<EventFeed, never, EventPublisher>
  .pipe(Layer.provide(EventPublisherLive))
```

### `infrastructure/adapters/in/browser-events.ts` (deleted)

All consumers now import `BrowserEvent` from the port.

## What is NOT changing

- `domain/events.ts` — `DomainEvent` union (including terminal events) unchanged
- `EventPublisher` port signature — unchanged
- WS schema `agentType` picklist in `daemon/ws-schemas.ts` — already correct
- Domain `type AgentType = string` — unchanged

## Backlog (out of scope)

- Separate terminal events (`TerminalOutputEvent`, `TerminalInputEchoEvent`, `TerminalResizedEvent`) from `domain/events.ts` into an application-layer type — requires changing `EventPublisher` port signature and all callers.

## Testing

- `event-feed.adapter.ts` can be tested by injecting a mock `EventPublisher`, triggering `publish()`, and asserting that `subscribe` listeners receive the correct `BrowserEvent`.
- `event-publisher.adapter.ts` tests are unaffected — no behavior change, only removal of browser concern.
