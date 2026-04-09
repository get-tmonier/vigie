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

const SessionErrorSchema = v.object({
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

const TerminalOutputEventSchema = v.object({
  type: v.literal('terminal:output'),
  sessionId: SessionIdSchema,
  data: v.string(),
  timestamp: v.number(),
});

export const TerminalInputEchoEventSchema = v.object({
  type: v.literal('terminal:input-echo'),
  sessionId: SessionIdSchema,
  text: v.string(),
  source: v.picklist(['cli', 'browser']),
  timestamp: v.number(),
});

const TerminalResizedEventSchema = v.object({
  type: v.literal('terminal:pty-resized'),
  sessionId: SessionIdSchema,
  cols: v.number(),
  rows: v.number(),
});

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
