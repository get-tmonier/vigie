import type { StructuredEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

interface HookPayload {
  type: string;
  [key: string]: unknown;
}

export function mapHookEvent(
  sessionId: SessionId,
  turnIndex: number,
  payload: HookPayload
): StructuredEvent[] {
  const now = Date.now();

  switch (payload.type) {
    case 'tool_use':
      return [
        {
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: payload.tool_name as string,
          toolCallId: payload.tool_call_id as string,
          input: (payload.input as Record<string, unknown>) ?? {},
          status: 'running',
          timestamp: now,
        },
      ];

    case 'tool_result':
      return [
        {
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: '',
          toolCallId: payload.tool_call_id as string,
          input: {},
          status: payload.is_error ? 'error' : 'completed',
          output: payload.is_error ? undefined : (payload.content as string),
          error: payload.is_error ? (payload.content as string) : undefined,
          timestamp: now,
        },
      ];

    case 'assistant_message':
      return [
        {
          type: 'agent:text-delta',
          sessionId,
          turnIndex,
          role: 'assistant',
          content: payload.content as string,
          timestamp: now,
        },
      ];

    case 'cost_update':
      return [
        {
          type: 'agent:cost-update',
          sessionId,
          turnIndex,
          inputTokens: (payload.input_tokens as number) ?? 0,
          outputTokens: (payload.output_tokens as number) ?? 0,
          cacheReadTokens: payload.cache_read_tokens as number | undefined,
          cacheWriteTokens: payload.cache_write_tokens as number | undefined,
          totalCostUsd: (payload.total_cost_usd as number) ?? 0,
          modelId: (payload.model_id as string) ?? 'unknown',
          timestamp: now,
        },
      ];

    case 'subagent_spawn':
      return [
        {
          type: 'agent:subagent-spawn',
          sessionId,
          turnIndex,
          parentToolCallId: payload.parent_tool_call_id as string,
          subagentSessionId: payload.subagent_session_id as string,
          description: (payload.description as string) ?? '',
          timestamp: now,
        },
      ];

    default:
      return [];
  }
}
