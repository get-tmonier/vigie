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
export type SessionStarted = v.InferOutput<typeof SessionStartedSchema>;

export const SessionEndedSchema = v.object({
  type: v.literal('session:ended'),
  sessionId: SessionIdSchema,
  exitCode: v.number(),
  resumable: v.boolean(),
  timestamp: v.number(),
});
export type SessionEnded = v.InferOutput<typeof SessionEndedSchema>;

export const SessionErrorSchema = v.object({
  type: v.literal('session:error'),
  sessionId: SessionIdSchema,
  error: v.string(),
  timestamp: v.number(),
});
export type SessionError = v.InferOutput<typeof SessionErrorSchema>;

export const SessionDeletedSchema = v.object({
  type: v.literal('session:deleted'),
  sessionId: SessionIdSchema,
  timestamp: v.number(),
});
export type SessionDeleted = v.InferOutput<typeof SessionDeletedSchema>;

export const SessionsClearedSchema = v.object({
  type: v.literal('sessions:cleared'),
  timestamp: v.number(),
});
export type SessionsCleared = v.InferOutput<typeof SessionsClearedSchema>;

export const AgentSessionIdDetectedSchema = v.object({
  type: v.literal('session:agent-id-detected'),
  sessionId: SessionIdSchema,
  agentSessionId: v.string(),
  timestamp: v.number(),
});
export type AgentSessionIdDetected = v.InferOutput<typeof AgentSessionIdDetectedSchema>;

export const ResumableChangedSchema = v.object({
  type: v.literal('session:resumable-changed'),
  sessionId: SessionIdSchema,
  resumable: v.boolean(),
  timestamp: v.number(),
});
export type ResumableChanged = v.InferOutput<typeof ResumableChangedSchema>;

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

export const TerminalOutputEventSchema = v.object({
  type: v.literal('terminal:output'),
  sessionId: SessionIdSchema,
  data: v.string(),
  timestamp: v.number(),
});
export type TerminalOutputEvent = v.InferOutput<typeof TerminalOutputEventSchema>;

export const TerminalInputEchoEventSchema = v.object({
  type: v.literal('terminal:input-echo'),
  sessionId: SessionIdSchema,
  text: v.string(),
  source: v.picklist(['cli', 'browser']),
  timestamp: v.number(),
});
export type TerminalInputEchoEvent = v.InferOutput<typeof TerminalInputEchoEventSchema>;

export const TerminalResizedEventSchema = v.object({
  type: v.literal('terminal:pty-resized'),
  sessionId: SessionIdSchema,
  cols: v.number(),
  rows: v.number(),
});
export type TerminalResizedEvent = v.InferOutput<typeof TerminalResizedEventSchema>;

export const TerminalChunkSchema = v.object({
  data: v.string(),
  timestamp: v.number(),
  seq: v.number(),
});
export type TerminalChunk = v.InferOutput<typeof TerminalChunkSchema>;

export const SessionEventSchema = v.variant('type', [
  SessionStartedSchema,
  SessionEndedSchema,
  SessionErrorSchema,
  SessionDeletedSchema,
  SessionsClearedSchema,
  AgentSessionIdDetectedSchema,
  ResumableChangedSchema,
  TerminalOutputEventSchema,
  TerminalInputEchoEventSchema,
  TerminalResizedEventSchema,
]);
export type SessionEvent = v.InferOutput<typeof SessionEventSchema>;
