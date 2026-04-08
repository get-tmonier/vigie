import { Data, Effect, Layer } from 'effect';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { DomainEvent } from '#modules/agent-session/domain/events';
import {
  type BrowserEvent,
  BrowserEventBus,
} from '#shell/application/ports/out/browser-event-bus.port';

class BrowserEventBusError extends Data.TaggedError('BrowserEventBusError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

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
    case 'session:agent-id-detected':
      return {
        type: 'session:agent-id-detected',
        sessionId: event.sessionId,
        agentSessionId: event.agentSessionId,
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
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return null;
    }
  }
}

export const BrowserEventBusLive = Layer.effect(BrowserEventBus)(
  Effect.gen(function* () {
    const eventPublisher = yield* DomainEventBus;
    const listeners = new Set<(event: BrowserEvent) => void>();
    // Capture service context so fire-and-forget listener dispatch via Effect.runForkWith has access to all services
    const services = yield* Effect.services();

    eventPublisher.subscribe((domainEvent) => {
      const browserEvent = domainEventToBrowserEvent(domainEvent);
      if (browserEvent) {
        for (const listener of listeners) {
          Effect.runForkWith(services)(
            Effect.try({
              try: () => listener(browserEvent),
              catch: (cause) => new BrowserEventBusError({ message: String(cause), cause }),
            }).pipe(Effect.catch((err) => Effect.logError(`browser listener error: ${err}`)))
          );
        }
      }
    });

    return {
      subscribe(listener: (event: BrowserEvent) => void): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  })
);
