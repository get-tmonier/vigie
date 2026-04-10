import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  CostUpdateSchema,
  SessionEventSchema,
  SessionLifecycleEventSchema,
  SessionStartedSchema,
  StructuredEventSchema,
  SubagentSpawnSchema,
  TerminalInputEchoSchema,
  TextDeltaSchema,
  ToolCallSchema,
  TurnCompletedSchema,
  TurnStartedSchema,
} from '../events';
import { SessionId } from '../session-id';

describe('SessionStartedSchema', () => {
  it('parses valid event and brands sessionId', () => {
    const result = v.parse(SessionStartedSchema, {
      type: 'session:started',
      sessionId: 'abc-123',
      agentType: 'claude',
      mode: 'interactive',
      cwd: '/home/user',
      timestamp: 1234567890,
    });
    expect(result.type).toBe('session:started');
    expect(String(result.sessionId)).toBe('abc-123');
    expect(result.agentType).toBe('claude');
  });

  it('rejects invalid agentType', () => {
    expect(() =>
      v.parse(SessionStartedSchema, {
        type: 'session:started',
        sessionId: 'abc-123',
        agentType: 'unknown-agent',
        mode: 'interactive',
        cwd: '/home/user',
        timestamp: 1234567890,
      })
    ).toThrow();
  });
});

describe('SessionLifecycleEventSchema', () => {
  it('dispatches on type discriminant', () => {
    const result = v.parse(SessionLifecycleEventSchema, {
      type: 'session:ended',
      sessionId: 'abc-123',
      exitCode: 0,
      resumable: true,
      timestamp: 1234567890,
    });
    expect(result.type).toBe('session:ended');
  });
});

describe('TerminalInputEchoSchema', () => {
  it('parses and brands sessionId', () => {
    const result = v.parse(TerminalInputEchoSchema, {
      type: 'terminal:input-echo',
      sessionId: 'abc-123',
      text: 'hello',
      source: 'cli',
      timestamp: 1234567890,
    });
    expect(String(result.sessionId)).toBe('abc-123');
  });
});

describe('StructuredEvent schemas', () => {
  const sessionId = SessionId('test-sess');

  it('validates TextDelta', () => {
    const result = v.safeParse(TextDeltaSchema, {
      type: 'agent:text-delta',
      sessionId,
      turnIndex: 0,
      role: 'assistant',
      content: 'Hello',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects TextDelta with invalid role', () => {
    const result = v.safeParse(TextDeltaSchema, {
      type: 'agent:text-delta',
      sessionId,
      turnIndex: 0,
      role: 'system',
      content: 'Hello',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('validates ToolCall', () => {
    const result = v.safeParse(ToolCallSchema, {
      type: 'agent:tool-call',
      sessionId,
      turnIndex: 1,
      toolName: 'Read',
      toolCallId: 'tc-1',
      input: { file_path: '/foo' },
      status: 'running',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates ToolCall with optional fields', () => {
    const result = v.safeParse(ToolCallSchema, {
      type: 'agent:tool-call',
      sessionId,
      turnIndex: 1,
      toolName: 'Read',
      toolCallId: 'tc-1',
      input: { file_path: '/foo' },
      status: 'completed',
      output: 'file contents',
      durationMs: 42,
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates CostUpdate', () => {
    const result = v.safeParse(CostUpdateSchema, {
      type: 'agent:cost-update',
      sessionId,
      turnIndex: 0,
      inputTokens: 1000,
      outputTokens: 500,
      totalCostUsd: 0.03,
      modelId: 'claude-sonnet-4-6',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates CostUpdate with cache tokens', () => {
    const result = v.safeParse(CostUpdateSchema, {
      type: 'agent:cost-update',
      sessionId,
      turnIndex: 0,
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 200,
      cacheWriteTokens: 50,
      totalCostUsd: 0.03,
      modelId: 'claude-sonnet-4-6',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates SubagentSpawn', () => {
    const result = v.safeParse(SubagentSpawnSchema, {
      type: 'agent:subagent-spawn',
      sessionId,
      turnIndex: 0,
      parentToolCallId: 'tc-1',
      subagentSessionId: 'sub-1',
      description: 'Research task',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates TurnStarted', () => {
    const result = v.safeParse(TurnStartedSchema, {
      type: 'agent:turn-started',
      sessionId,
      turnIndex: 0,
      prompt: 'Fix the bug',
      mode: 'manual',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates TurnCompleted', () => {
    const result = v.safeParse(TurnCompletedSchema, {
      type: 'agent:turn-completed',
      sessionId,
      turnIndex: 0,
      stopReason: 'end_turn',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates TurnCompleted with summary', () => {
    const result = v.safeParse(TurnCompletedSchema, {
      type: 'agent:turn-completed',
      sessionId,
      turnIndex: 0,
      stopReason: 'pause',
      summary: 'Done with first pass',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('StructuredEventSchema accepts all 6 event types', () => {
    const events = [
      {
        type: 'agent:text-delta',
        sessionId,
        turnIndex: 0,
        role: 'assistant',
        content: 'Hi',
        timestamp: Date.now(),
      },
      {
        type: 'agent:tool-call',
        sessionId,
        turnIndex: 0,
        toolName: 'Read',
        toolCallId: 'tc-1',
        input: {},
        status: 'running',
        timestamp: Date.now(),
      },
      {
        type: 'agent:cost-update',
        sessionId,
        turnIndex: 0,
        inputTokens: 100,
        outputTokens: 50,
        totalCostUsd: 0.01,
        modelId: 'claude-sonnet-4-6',
        timestamp: Date.now(),
      },
      {
        type: 'agent:subagent-spawn',
        sessionId,
        turnIndex: 0,
        parentToolCallId: 'tc-1',
        subagentSessionId: 'sub-1',
        description: 'test',
        timestamp: Date.now(),
      },
      {
        type: 'agent:turn-started',
        sessionId,
        turnIndex: 0,
        prompt: 'hi',
        mode: 'manual',
        timestamp: Date.now(),
      },
      {
        type: 'agent:turn-completed',
        sessionId,
        turnIndex: 0,
        stopReason: 'end_turn',
        timestamp: Date.now(),
      },
    ];
    for (const event of events) {
      const result = v.safeParse(StructuredEventSchema, event);
      expect(result.success).toBe(true);
    }
  });

  it('SessionEventSchema accepts both lifecycle and structured events', () => {
    const lifecycle = v.safeParse(SessionEventSchema, {
      type: 'session:started',
      sessionId,
      agentType: 'claude',
      mode: 'prompt',
      cwd: '/tmp',
      timestamp: Date.now(),
    });
    const structured = v.safeParse(SessionEventSchema, {
      type: 'agent:text-delta',
      sessionId,
      turnIndex: 0,
      role: 'assistant',
      content: 'Hi',
      timestamp: Date.now(),
    });
    expect(lifecycle.success).toBe(true);
    expect(structured.success).toBe(true);
  });
});
