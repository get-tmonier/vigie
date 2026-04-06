import * as v from 'valibot';

export const ClaudeAssistantTextSchema = v.object({
  type: v.literal('assistant'),
  subtype: v.optional(v.literal('text')),
  message: v.object({
    type: v.literal('text'),
    text: v.string(),
  }),
});

export const ClaudeAssistantThinkingSchema = v.object({
  type: v.literal('assistant'),
  subtype: v.optional(v.literal('thinking')),
  message: v.object({
    type: v.literal('thinking'),
    text: v.string(),
  }),
});

export const ClaudeToolUseSchema = v.object({
  type: v.literal('tool_use'),
  tool: v.object({
    name: v.string(),
    input: v.optional(v.unknown()),
  }),
});

export const ClaudeToolResultSchema = v.object({
  type: v.literal('tool_result'),
  content: v.optional(v.unknown()),
});

export const ClaudeResultSchema = v.object({
  type: v.literal('result'),
  result: v.optional(v.string()),
  cost: v.optional(
    v.object({
      input_tokens: v.optional(v.number()),
      output_tokens: v.optional(v.number()),
    })
  ),
  duration_ms: v.optional(v.number()),
  session_id: v.optional(v.string()),
});

export const ClaudeSystemSchema = v.object({
  type: v.literal('system'),
  subtype: v.optional(v.string()),
  message: v.optional(v.string()),
  session_id: v.optional(v.string()),
});

export const ClaudeStreamEventSchema = v.variant('type', [
  ClaudeAssistantTextSchema,
  ClaudeAssistantThinkingSchema,
  ClaudeToolUseSchema,
  ClaudeToolResultSchema,
  ClaudeResultSchema,
  ClaudeSystemSchema,
]);
