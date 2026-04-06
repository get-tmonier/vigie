import type { SessionDomainEvent } from '#modules/session/domain/events';

export type TerminalOutputEvent = {
  readonly type: 'terminal:output';
  readonly sessionId: string;
  readonly data: string;
  readonly timestamp: number;
};

export type TerminalInputEchoEvent = {
  readonly type: 'terminal:input-echo';
  readonly sessionId: string;
  readonly text: string;
  readonly source: 'cli' | 'browser';
  readonly timestamp: number;
};

export type TerminalResizedEvent = {
  readonly type: 'terminal:pty-resized';
  readonly sessionId: string;
  readonly cols: number;
  readonly rows: number;
};

export type DomainEvent =
  | SessionDomainEvent
  | TerminalOutputEvent
  | TerminalInputEchoEvent
  | TerminalResizedEvent;

export interface EventPublisher {
  publish(event: DomainEvent): void;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}
