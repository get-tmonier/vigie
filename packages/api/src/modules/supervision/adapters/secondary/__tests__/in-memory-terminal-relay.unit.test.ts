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

  it('should not replay buffered data on subscribe (live-only)', async () => {
    const received: string[] = [];

    await run(
      Effect.gen(function* () {
        const relay = yield* Effect.service(TerminalRelay);
        yield* relay.create('s3');
        yield* relay.write('s3', btoa('before subscribe'));
        yield* relay.subscribe('s3', (data) => received.push(data));

        // No replay — subscriber only gets live data from this point
        expect(received.length).toBe(0);

        yield* relay.write('s3', btoa('after subscribe'));
        expect(received.length).toBe(1);
        expect(atob(received[0])).toBe('after subscribe');

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
