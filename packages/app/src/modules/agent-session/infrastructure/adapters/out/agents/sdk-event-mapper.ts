import type { StructuredEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

// Minimal SDK message type definitions (we define our own to avoid coupling to SDK internals)
interface SdkSystemInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: unknown[];
  model: string;
  cwd: string;
}

interface SdkAssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    role: string;
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
    >;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    model: string;
  };
}

interface SdkResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  session_id: string;
  total_cost_usd: number;
  usage: { input_tokens: number; output_tokens: number };
}

type SdkMessage = SdkSystemInit | SdkAssistantMessage | SdkResultMessage | { type: string };

type MapResult =
  | { kind: 'session-id-detected'; agentSessionId: string }
  | { kind: 'events'; events: StructuredEvent[] }
  | {
      kind: 'turn-completed';
      stopReason: 'end_turn' | 'max_tokens' | 'pause' | 'error';
      totalCostUsd: number;
    }
  | { kind: 'skip' };

const processedMessageIds = new Set<string>();

export function mapSdkMessage(sessionId: SessionId, turnIndex: number, raw: unknown): MapResult {
  const msg = raw as SdkMessage;

  if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
    const init = msg as SdkSystemInit;
    return { kind: 'session-id-detected', agentSessionId: init.session_id };
  }

  if (msg.type === 'assistant' && 'message' in msg) {
    const assistant = msg as SdkAssistantMessage;
    const msgId = assistant.message.id;

    if (processedMessageIds.has(msgId)) return { kind: 'skip' };
    processedMessageIds.add(msgId);

    const events: StructuredEvent[] = [];
    const now = Date.now();

    for (const block of assistant.message.content) {
      if (block.type === 'text') {
        events.push({
          type: 'agent:text-delta',
          sessionId,
          turnIndex,
          role: 'assistant',
          content: block.text,
          timestamp: now,
        });
      } else if (block.type === 'tool_use') {
        events.push({
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: block.name,
          toolCallId: block.id,
          input: block.input,
          status: 'running',
          timestamp: now,
        });
      } else if (block.type === 'tool_result') {
        events.push({
          type: 'agent:tool-call',
          sessionId,
          turnIndex,
          toolName: '',
          toolCallId: block.tool_use_id,
          input: {},
          status: block.is_error ? 'error' : 'completed',
          output: block.is_error ? undefined : block.content,
          error: block.is_error ? block.content : undefined,
          timestamp: now,
        });
      }
    }

    // Cost from usage
    const usage = assistant.message.usage;
    events.push({
      type: 'agent:cost-update',
      sessionId,
      turnIndex,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
      cacheWriteTokens: usage.cache_creation_input_tokens,
      totalCostUsd: 0,
      modelId: assistant.message.model,
      timestamp: now,
    });

    return { kind: 'events', events };
  }

  if (msg.type === 'result') {
    const result = msg as SdkResultMessage;
    return {
      kind: 'turn-completed',
      stopReason: result.subtype === 'success' ? 'end_turn' : 'error',
      totalCostUsd: result.total_cost_usd,
    };
  }

  return { kind: 'skip' };
}

export function resetMessageDedup(): void {
  processedMessageIds.clear();
}
