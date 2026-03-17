import { describe, expect, it } from 'bun:test';
import type { SSEEvent } from '@tmonier/shared';
import { inputEchoReceived, inputHistoryReducer } from '../model/input-history-slice';

const initialState = { entriesBySessionId: {}, seenKeysBySessionId: {} };

function echo(sessionId: string, text: string, timestamp: number): SSEEvent {
  return {
    type: 'terminal:input-echo',
    daemonId: 'd-1',
    sessionId,
    text,
    source: 'cli',
    timestamp,
  } as SSEEvent;
}

describe('inputHistorySlice', () => {
  describe('inputEchoReceived dedup', () => {
    it('adds a new entry', () => {
      const state = inputHistoryReducer(
        initialState,
        inputEchoReceived(echo('s-1', 'ls', 1000) as never)
      );
      expect(state.entriesBySessionId['s-1']).toHaveLength(1);
      expect(state.entriesBySessionId['s-1']?.[0]?.text).toBe('ls');
    });

    it('same timestamp+text twice → deduped to 1 entry', () => {
      const action = inputEchoReceived(echo('s-1', 'ls', 1000) as never);
      let state = inputHistoryReducer(initialState, action);
      state = inputHistoryReducer(state, action);
      expect(state.entriesBySessionId['s-1']).toHaveLength(1);
    });

    it('same text different timestamp → 2 entries', () => {
      let state = inputHistoryReducer(
        initialState,
        inputEchoReceived(echo('s-1', 'ls', 1000) as never)
      );
      state = inputHistoryReducer(state, inputEchoReceived(echo('s-1', 'ls', 2000) as never));
      expect(state.entriesBySessionId['s-1']).toHaveLength(2);
    });

    it('keeps entries separate per session', () => {
      let state = inputHistoryReducer(
        initialState,
        inputEchoReceived(echo('s-1', 'cmd1', 1000) as never)
      );
      state = inputHistoryReducer(state, inputEchoReceived(echo('s-2', 'cmd2', 1000) as never));
      expect(state.entriesBySessionId['s-1']).toHaveLength(1);
      expect(state.entriesBySessionId['s-2']).toHaveLength(1);
    });
  });

  describe('survives reset then re-receive', () => {
    it('after reset, same event is accepted again', () => {
      const action = inputEchoReceived(echo('s-1', 'ls', 1000) as never);
      let state = inputHistoryReducer(initialState, action);
      // Simulate a reset (fresh initialState)
      state = inputHistoryReducer(initialState, action);
      expect(state.entriesBySessionId['s-1']).toHaveLength(1);
    });
  });
});
