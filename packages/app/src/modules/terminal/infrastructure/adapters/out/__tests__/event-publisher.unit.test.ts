import { describe, expect, it } from 'bun:test';
import { createEventPublisher } from '../event-publisher.adapter';

function makeStartedEvent() {
  return {
    type: 'session:started' as const,
    sessionId: 'sess-1' as ReturnType<
      typeof import('#modules/session/domain/session-id').SessionId
    >,
    agentType: 'claude',
    mode: 'prompt' as const,
    cwd: '/tmp',
    timestamp: Date.now(),
  };
}

describe('EventPublisher', () => {
  it('publish delivers to all subscribe listeners', () => {
    const publisher = createEventPublisher();
    const received: string[] = [];
    publisher.subscribe((e) => received.push(e.type));
    publisher.subscribe((e) => received.push(e.type + '-2'));
    publisher.publish(makeStartedEvent());
    expect(received).toEqual(['session:started', 'session:started-2']);
  });

  it('subscribe returns unsubscribe fn that stops delivery', () => {
    const publisher = createEventPublisher();
    const received: string[] = [];
    const unsub = publisher.subscribe((e) => received.push(e.type));
    publisher.publish(makeStartedEvent());
    unsub();
    publisher.publish(makeStartedEvent());
    expect(received).toHaveLength(1);
  });

  it('listener throwing error does not break other listeners', () => {
    const publisher = createEventPublisher();
    const received: string[] = [];
    publisher.subscribe(() => {
      throw new Error('oops');
    });
    publisher.subscribe((e) => received.push(e.type));
    publisher.publish(makeStartedEvent());
    expect(received).toHaveLength(1);
  });

  it('subscribeBrowser receives mapped browser events for session:started', () => {
    const publisher = createEventPublisher();
    const browserEvents: string[] = [];
    publisher.subscribeBrowser((e) => browserEvents.push(e.type));
    publisher.publish(makeStartedEvent());
    expect(browserEvents).toEqual(['session:started']);
  });

  it('terminal:output events do not reach browser listeners', () => {
    const publisher = createEventPublisher();
    const browserEvents: string[] = [];
    publisher.subscribeBrowser((e) => browserEvents.push(e.type));
    publisher.publish({
      type: 'terminal:output',
      sessionId: 'sess-1',
      data: 'some data',
      timestamp: Date.now(),
    });
    expect(browserEvents).toHaveLength(0);
  });
});
