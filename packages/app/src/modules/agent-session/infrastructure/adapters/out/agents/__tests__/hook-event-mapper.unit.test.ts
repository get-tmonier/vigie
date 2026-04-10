import { describe, expect, it } from 'bun:test';
import { SessionId } from '#shared/kernel/session/session-id';
import { mapHookEvent } from '../hook-event-mapper';

describe('mapHookEvent', () => {
  const sessionId = SessionId('sess-1');

  it('maps tool_use to ToolCall running', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'tool_use',
      tool_name: 'Read',
      tool_call_id: 'tc-1',
      input: { file_path: '/foo.ts' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('agent:tool-call');
    if (result[0].type === 'agent:tool-call') {
      expect(result[0].status).toBe('running');
      expect(result[0].toolName).toBe('Read');
    }
  });

  it('maps tool_result to ToolCall completed', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'tool_result',
      tool_call_id: 'tc-1',
      content: 'file contents',
      is_error: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('agent:tool-call');
    if (result[0].type === 'agent:tool-call') {
      expect(result[0].status).toBe('completed');
      expect(result[0].output).toBe('file contents');
    }
  });

  it('maps tool_result error', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'tool_result',
      tool_call_id: 'tc-1',
      content: 'error message',
      is_error: true,
    });
    expect(result).toHaveLength(1);
    if (result[0].type === 'agent:tool-call') {
      expect(result[0].status).toBe('error');
      expect(result[0].error).toBe('error message');
    }
  });

  it('maps assistant_message to TextDelta', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'assistant_message',
      content: 'Hello world',
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('agent:text-delta');
  });

  it('maps cost_update to CostUpdate', () => {
    const result = mapHookEvent(sessionId, 0, {
      type: 'cost_update',
      input_tokens: 1000,
      output_tokens: 500,
      total_cost_usd: 0.03,
      model_id: 'claude-sonnet-4-6',
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('agent:cost-update');
  });

  it('returns empty for unknown type', () => {
    const result = mapHookEvent(sessionId, 0, { type: 'unknown_event' });
    expect(result).toHaveLength(0);
  });
});
