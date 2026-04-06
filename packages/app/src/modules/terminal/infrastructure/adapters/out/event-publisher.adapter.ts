import { Effect, Layer, ServiceMap } from 'effect';
import {
  type DomainEvent,
  EventPublisher,
  type EventPublisherShape,
} from '#modules/terminal/application/ports/out/event-publisher.port';
import type { BrowserEvent } from '#modules/terminal/infrastructure/adapters/in/browser-events';

function domainEventToBrowserEvent(event: DomainEvent): BrowserEvent | null {
  switch (event.type) {
    case 'session:started':
      return {
        type: 'session:started',
        sessionId: event.sessionId,
        agentType: event.agentType,
        mode: event.mode,
        cwd: event.cwd,
        gitBranch: event.gitBranch,
        repoName: event.repoName,
        timestamp: event.timestamp,
      };
    case 'session:ended':
      return {
        type: 'session:ended',
        sessionId: event.sessionId,
        exitCode: event.exitCode,
        resumable: event.resumable,
        timestamp: event.timestamp,
      };
    case 'session:error':
      return {
        type: 'session:error',
        sessionId: event.sessionId,
        error: event.error,
        timestamp: event.timestamp,
      };
    case 'session:deleted':
      return {
        type: 'session:deleted',
        sessionId: event.sessionId,
        timestamp: event.timestamp,
      };
    case 'sessions:cleared':
      return { type: 'sessions:cleared', timestamp: event.timestamp };
    case 'session:claude-id-detected':
      return {
        type: 'session:claude-id-detected',
        sessionId: event.sessionId,
        claudeSessionId: event.claudeSessionId,
        timestamp: event.timestamp,
      };
    case 'session:resumable-changed':
      return {
        type: 'session:resumable-changed',
        sessionId: event.sessionId,
        resumable: event.resumable,
        timestamp: event.timestamp,
      };
    case 'terminal:input-echo':
      return {
        type: 'terminal:input-echo',
        sessionId: event.sessionId,
        text: event.text,
        source: event.source,
        timestamp: event.timestamp,
      };
    case 'terminal:pty-resized':
      return {
        type: 'terminal:pty-resized',
        sessionId: event.sessionId,
        cols: event.cols,
        rows: event.rows,
      };
    case 'terminal:output':
      return null; // terminal output goes through terminal subscribers, not event bus
    default:
      return null;
  }
}

export function createEventPublisher(): AppEventPublisher {
  const listeners = new Set<(event: DomainEvent) => void>();
  const browserListeners = new Set<(event: BrowserEvent) => void>();

  return {
    publish(event: DomainEvent): void {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {}
      }

      const browserEvent = domainEventToBrowserEvent(event);
      if (browserEvent) {
        for (const listener of browserListeners) {
          try {
            listener(browserEvent);
          } catch {}
        }
      }
    },

    subscribe(listener: (event: DomainEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    subscribeBrowser(listener: (event: BrowserEvent) => void): () => void {
      browserListeners.add(listener);
      return () => {
        browserListeners.delete(listener);
      };
    },
  };
}

export type AppEventPublisher = EventPublisherShape & {
  subscribeBrowser: (listener: (event: BrowserEvent) => void) => () => void;
};

export class AppEventPublisherTag extends ServiceMap.Service<
  AppEventPublisherTag,
  AppEventPublisher
>()('@vigie/AppEventPublisher') {}

// Creates one AppEventPublisher instance and exposes it under both tags:
// - AppEventPublisherTag (extended type with subscribeBrowser, used in HTTP routes)
// - EventPublisher (base interface, used in session.service)
// Use provideMerge so AppEventPublisherTag satisfies EventPublisher layer's requirement (no circular dep)
export const EventPublisherLayer = Layer.effect(EventPublisher)(
  Effect.gen(function* () {
    return yield* AppEventPublisherTag;
  })
).pipe(Layer.provideMerge(Layer.sync(AppEventPublisherTag)(() => createEventPublisher())));
