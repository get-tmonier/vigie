import * as v from 'valibot';
import { AgentTypeSchema } from './agent-type';
import { SessionIdSchema } from './session-id';

export const SessionStartedSchema = v.object({
  type: v.literal('session:started'),
  sessionId: SessionIdSchema,
  agentType: AgentTypeSchema,
  mode: v.picklist(['prompt', 'interactive']),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  timestamp: v.number(),
});

const SessionEndedSchema = v.object({
  type: v.literal('session:ended'),
  sessionId: SessionIdSchema,
  exitCode: v.number(),
  resumable: v.boolean(),
  timestamp: v.number(),
});

export const SessionErrorSchema = v.object({
  type: v.literal('session:error'),
  sessionId: SessionIdSchema,
  error: v.string(),
  timestamp: v.number(),
});

const SessionDeletedSchema = v.object({
  type: v.literal('session:deleted'),
  sessionId: SessionIdSchema,
  timestamp: v.number(),
});

const SessionsClearedSchema = v.object({
  type: v.literal('sessions:cleared'),
  timestamp: v.number(),
});

const AgentSessionIdDetectedSchema = v.object({
  type: v.literal('session:agent-id-detected'),
  sessionId: SessionIdSchema,
  agentSessionId: v.string(),
  timestamp: v.number(),
});

const ResumableChangedSchema = v.object({
  type: v.literal('session:resumable-changed'),
  sessionId: SessionIdSchema,
  resumable: v.boolean(),
  timestamp: v.number(),
});

export const SessionLifecycleEventSchema = v.variant('type', [
  SessionStartedSchema,
  SessionEndedSchema,
  SessionErrorSchema,
  SessionDeletedSchema,
  SessionsClearedSchema,
  AgentSessionIdDetectedSchema,
  ResumableChangedSchema,
]);
export type SessionLifecycleEvent = v.InferOutput<typeof SessionLifecycleEventSchema>;

export const TerminalInputEchoSchema = v.object({
  type: v.literal('terminal:input-echo'),
  sessionId: SessionIdSchema,
  text: v.string(),
  source: v.picklist(['cli', 'browser']),
  timestamp: v.number(),
});

const TerminalResizedSchema = v.object({
  type: v.literal('terminal:pty-resized'),
  sessionId: SessionIdSchema,
  cols: v.number(),
  rows: v.number(),
});

// --- Structured Agent Events (M0) ---

export const TextDeltaSchema = v.object({
  type: v.literal('agent:text-delta'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  role: v.picklist(['assistant', 'user']),
  content: v.string(),
  timestamp: v.number(),
});

export const ToolCallSchema = v.object({
  type: v.literal('agent:tool-call'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  toolName: v.string(),
  toolCallId: v.string(),
  input: v.record(v.string(), v.unknown()),
  status: v.picklist(['running', 'completed', 'error']),
  output: v.optional(v.string()),
  error: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  timestamp: v.number(),
});

export const CostUpdateSchema = v.object({
  type: v.literal('agent:cost-update'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.optional(v.number()),
  cacheWriteTokens: v.optional(v.number()),
  totalCostUsd: v.number(),
  modelId: v.string(),
  timestamp: v.number(),
});

export const SubagentSpawnSchema = v.object({
  type: v.literal('agent:subagent-spawn'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  parentToolCallId: v.string(),
  subagentSessionId: v.string(),
  description: v.string(),
  timestamp: v.number(),
});

export const TurnStartedSchema = v.object({
  type: v.literal('agent:turn-started'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  prompt: v.string(),
  mode: v.picklist(['auto', 'manual']),
  timestamp: v.number(),
});

export const TurnCompletedSchema = v.object({
  type: v.literal('agent:turn-completed'),
  sessionId: SessionIdSchema,
  turnIndex: v.number(),
  stopReason: v.picklist(['end_turn', 'max_tokens', 'pause', 'error']),
  summary: v.optional(v.string()),
  timestamp: v.number(),
});

export const StructuredEventSchema = v.variant('type', [
  TextDeltaSchema,
  ToolCallSchema,
  CostUpdateSchema,
  SubagentSpawnSchema,
  TurnStartedSchema,
  TurnCompletedSchema,
]);

export type TextDelta = v.InferOutput<typeof TextDeltaSchema>;
export type ToolCall = v.InferOutput<typeof ToolCallSchema>;
export type CostUpdate = v.InferOutput<typeof CostUpdateSchema>;
export type SubagentSpawn = v.InferOutput<typeof SubagentSpawnSchema>;
export type TurnStarted = v.InferOutput<typeof TurnStartedSchema>;
export type TurnCompleted = v.InferOutput<typeof TurnCompletedSchema>;

export const SessionEventSchema = v.variant('type', [
  SessionStartedSchema,
  SessionEndedSchema,
  SessionErrorSchema,
  SessionDeletedSchema,
  SessionsClearedSchema,
  AgentSessionIdDetectedSchema,
  ResumableChangedSchema,
  TerminalInputEchoSchema,
  TerminalResizedSchema,
  TextDeltaSchema,
  ToolCallSchema,
  CostUpdateSchema,
  SubagentSpawnSchema,
  TurnStartedSchema,
  TurnCompletedSchema,
]);
export type SessionEvent = v.InferOutput<typeof SessionEventSchema>;
