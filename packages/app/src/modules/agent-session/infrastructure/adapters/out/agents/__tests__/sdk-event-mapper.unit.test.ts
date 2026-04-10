import { beforeEach, describe, expect, it } from 'bun:test';
import { SessionId } from '#shared/kernel/session/session-id';
import { mapSdkMessage, resetMessageDedup } from '../sdk-event-mapper';

const sessionId = SessionId('sess-1');

beforeEach(() => {
  resetMessageDedup();
});

describe('mapSdkMessage', () => {
  it('maps system init to session-id-detected', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'system',
      subtype: 'init',
      session_id: 'claude-sess-abc',
      tools: [],
      model: 'claude-sonnet-4-6',
      cwd: '/tmp',
    });
    expect(result).toEqual({
      kind: 'session-id-detected',
      agentSessionId: 'claude-sess-abc',
    });
  });

  it('maps assistant text to TextDelta', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'assistant',
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-6',
      },
    });
    expect(result.kind).toBe('events');
    if (result.kind !== 'events') return;
    expect(result.events.some((e) => e.type === 'agent:text-delta')).toBe(true);
    expect(result.events.some((e) => e.type === 'agent:cost-update')).toBe(true);
  });

  it('maps tool_use to ToolCall running', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'assistant',
      message: {
        id: 'msg-2',
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tc-1', name: 'Read', input: { file_path: '/foo' } }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-6',
      },
    });
    expect(result.kind).toBe('events');
    if (result.kind !== 'events') return;
    const toolCall = result.events.find((e) => e.type === 'agent:tool-call');
    expect(toolCall).toBeDefined();
    if (toolCall?.type === 'agent:tool-call') {
      expect(toolCall.status).toBe('running');
      expect(toolCall.toolName).toBe('Read');
    }
  });

  it('deduplicates by message ID', () => {
    const msg = {
      type: 'assistant',
      message: {
        id: 'msg-dup',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-6',
      },
    };
    const first = mapSdkMessage(sessionId, 0, msg);
    const second = mapSdkMessage(sessionId, 0, msg);
    expect(first.kind).toBe('events');
    expect(second.kind).toBe('skip');
  });

  it('maps result success to turn-completed', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'result',
      subtype: 'success',
      session_id: 'claude-sess-abc',
      total_cost_usd: 0.05,
      usage: { input_tokens: 3000, output_tokens: 1000 },
    });
    expect(result).toEqual({
      kind: 'turn-completed',
      stopReason: 'end_turn',
      totalCostUsd: 0.05,
    });
  });

  it('maps result error to turn-completed with error reason', () => {
    const result = mapSdkMessage(sessionId, 0, {
      type: 'result',
      subtype: 'error',
      session_id: 'claude-sess-abc',
      total_cost_usd: 0.02,
      usage: { input_tokens: 1000, output_tokens: 200 },
    });
    expect(result).toEqual({
      kind: 'turn-completed',
      stopReason: 'error',
      totalCostUsd: 0.02,
    });
  });

  it('skips unknown message types', () => {
    const result = mapSdkMessage(sessionId, 0, { type: 'unknown_type' });
    expect(result.kind).toBe('skip');
  });
});
