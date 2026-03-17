import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';
import { InMemoryTerminalRelayLive } from '../in-memory-terminal-relay';

const testLayer = InMemoryTerminalRelayLive;

function run<A>(effect: Effect.Effect<A, never, TerminalRelay>) {
  return Effect.runPromise(Effect.provide(effect, testLayer));
}

describe('InMemoryTerminalRelay', () => {
  it('should create and destroy a relay', async () => {
    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s1');
        yield* relay.destroy('s1');
      })
    );
  });

  it('should broadcast writes to subscribers immediately', async () => {
    const received: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s2');
        yield* relay.subscribe('s2', (data) => received.push(data));

        yield* relay.write('s2', btoa('live data'));

        expect(received.length).toBe(1);
        expect(atob(received[0])).toBe('live data');

        yield* relay.destroy('s2');
      })
    );
  });

  it('should replay buffered data on subscribe', async () => {
    const received: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s3');
        yield* relay.write('s3', btoa('before subscribe'));
        yield* relay.subscribe('s3', (data) => received.push(data));

        // Replay — subscriber gets buffered data on subscribe
        expect(received.length).toBe(1);
        expect(atob(received[0])).toBe('before subscribe');

        yield* relay.write('s3', btoa('after subscribe'));
        expect(received.length).toBe(2);
        expect(atob(received[1])).toBe('after subscribe');

        yield* relay.destroy('s3');
      })
    );
  });

  it('should handle unsubscribe correctly', async () => {
    const received: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s4');
        const unsub = yield* relay.subscribe('s4', (data) => received.push(data));

        unsub();

        yield* relay.write('s4', btoa('after unsub'));

        expect(received.length).toBe(0);
        yield* relay.destroy('s4');
      })
    );
  });

  it('should return noop unsubscribe for non-existent session', async () => {
    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        const unsub = yield* relay.subscribe('nonexistent', () => {});
        unsub();
      })
    );
  });

  it('should handle destroy on non-existent session', async () => {
    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.destroy('nonexistent');
      })
    );
  });

  it('should replay full buffer on reconnect after unsubscribe', async () => {
    const first: string[] = [];
    const second: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s-reconnect');

        // First browser connects and receives live data
        const unsub1 = yield* relay.subscribe('s-reconnect', (data) => first.push(data));
        yield* relay.write('s-reconnect', btoa('line 1'));
        yield* relay.write('s-reconnect', btoa('line 2'));
        expect(first.length).toBe(2);

        // Browser navigates away
        unsub1();

        // More output while disconnected
        yield* relay.write('s-reconnect', btoa('line 3'));

        // Browser reconnects — should get full history
        yield* relay.subscribe('s-reconnect', (data) => second.push(data));
        expect(second.length).toBe(3);
        expect(atob(second[0])).toBe('line 1');
        expect(atob(second[1])).toBe('line 2');
        expect(atob(second[2])).toBe('line 3');

        yield* relay.destroy('s-reconnect');
      })
    );
  });

  it('should clear buffer on re-create (resume scenario) but preserve existing subscribers', async () => {
    const received: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);

        // Session runs and accumulates output
        yield* relay.create('s-resume');
        yield* relay.write('s-resume', btoa('old output'));

        // Browser connects while session is active — subscribes and gets old output replayed
        yield* relay.subscribe('s-resume', (data) => received.push(data));
        expect(received).toHaveLength(1);
        expect(atob(received[0])).toBe('old output');

        // Session ends (relay destroyed), then resume starts (relay re-created)
        yield* relay.destroy('s-resume');
        yield* relay.create('s-resume');

        // Re-subscribe after resume — buffer should be empty, no stale data replayed
        const afterResume: string[] = [];
        yield* relay.subscribe('s-resume', (data) => afterResume.push(data));
        expect(afterResume).toHaveLength(0);

        // New output from resumed session flows in cleanly
        yield* relay.write('s-resume', btoa('new output'));
        expect(afterResume).toHaveLength(1);
        expect(atob(afterResume[0])).toBe('new output');

        yield* relay.destroy('s-resume');
      })
    );
  });

  it('should not replay stale buffer to subscriber that connects after re-create', async () => {
    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);

        // Session accumulates output
        yield* relay.create('s-stale');
        yield* relay.write('s-stale', btoa('chunk 1'));
        yield* relay.write('s-stale', btoa('chunk 2'));

        // Simulate session:started for resumed session — re-create clears buffer
        yield* relay.create('s-stale');
        expect(yield* relay.getBufferSize('s-stale')).toBe(0);

        // New subscriber only sees new output
        const received: string[] = [];
        yield* relay.subscribe('s-stale', (data) => received.push(data));
        expect(received).toHaveLength(0);

        yield* relay.write('s-stale', btoa('resumed output'));
        expect(received).toHaveLength(1);
        expect(atob(received[0])).toBe('resumed output');

        yield* relay.destroy('s-stale');
      })
    );
  });

  it('should broadcast to multiple subscribers', async () => {
    const received1: string[] = [];
    const received2: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s5');
        yield* relay.subscribe('s5', (data) => received1.push(data));
        yield* relay.subscribe('s5', (data) => received2.push(data));

        yield* relay.write('s5', btoa('broadcast'));

        expect(received1.length).toBe(1);
        expect(received2.length).toBe(1);
        expect(atob(received1[0])).toBe('broadcast');
        expect(atob(received2[0])).toBe('broadcast');

        yield* relay.destroy('s5');
      })
    );
  });
});
