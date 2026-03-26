import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  ClaudeAssistantTextSchema,
  ClaudeAssistantThinkingSchema,
  ClaudeResultSchema,
  ClaudeStreamEventSchema,
  ClaudeSystemSchema,
  ClaudeToolResultSchema,
  ClaudeToolUseSchema,
} from '../schemas/claude-stream.js';

describe('Claude stream schemas', () => {
  it('parses assistant text message', () => {
    const event = {
      type: 'assistant',
      message: { type: 'text', text: 'Hello world' },
    };
    const result = v.parse(ClaudeAssistantTextSchema, event);
    expect(result.message.text).toBe('Hello world');
  });

  it('parses assistant thinking message', () => {
    const event = {
      type: 'assistant',
      message: { type: 'thinking', text: 'Let me think...' },
    };
    const result = v.parse(ClaudeAssistantThinkingSchema, event);
    expect(result.message.text).toBe('Let me think...');
  });

  it('parses tool_use event', () => {
    const event = {
      type: 'tool_use',
      tool: { name: 'Read', input: { file_path: '/tmp/test.ts' } },
    };
    const result = v.parse(ClaudeToolUseSchema, event);
    expect(result.tool.name).toBe('Read');
  });

  it('parses tool_result event', () => {
    const event = {
      type: 'tool_result',
      content: 'file contents here',
    };
    const result = v.parse(ClaudeToolResultSchema, event);
    expect(result.content).toBe('file contents here');
  });

  it('parses result event with cost', () => {
    const event = {
      type: 'result',
      result: 'Done!',
      cost: { input_tokens: 100, output_tokens: 50 },
      duration_ms: 3000,
    };
    const result = v.parse(ClaudeResultSchema, event);
    expect(result.cost?.input_tokens).toBe(100);
    expect(result.duration_ms).toBe(3000);
  });

  it('parses system event', () => {
    const event = {
      type: 'system',
      subtype: 'init',
      message: 'Session started',
    };
    const result = v.parse(ClaudeSystemSchema, event);
    expect(result.subtype).toBe('init');
  });

  it('parses discriminated union for all types', () => {
    const text = v.parse(ClaudeStreamEventSchema, {
      type: 'assistant',
      message: { type: 'text', text: 'hi' },
    });
    expect(text.type).toBe('assistant');

    const result = v.parse(ClaudeStreamEventSchema, {
      type: 'result',
    });
    expect(result.type).toBe('result');
  });
});
