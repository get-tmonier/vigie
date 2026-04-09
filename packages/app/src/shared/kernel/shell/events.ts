import * as v from 'valibot';
import { TerminalChunkSchema } from '#shared/kernel/agent-session/events';
import { SessionIdSchema } from '#shared/kernel/agent-session/session-id';

export const DaemonHelloSchema = v.object({
  type: v.literal('daemon:hello'),
  hostname: v.string(),
  pid: v.number(),
  version: v.string(),
});
export type DaemonHelloEvent = v.InferOutput<typeof DaemonHelloSchema>;

export const CommandOutputSchema = v.object({
  type: v.literal('command:output'),
  id: v.string(),
  stream: v.picklist(['stdout', 'stderr']),
  data: v.string(),
  timestamp: v.number(),
});
export type CommandOutputEvent = v.InferOutput<typeof CommandOutputSchema>;

export const CommandDoneSchema = v.object({
  type: v.literal('command:done'),
  id: v.string(),
  exitCode: v.number(),
  timestamp: v.number(),
});
export type CommandDoneEvent = v.InferOutput<typeof CommandDoneSchema>;

export const CommandErrorSchema = v.object({
  type: v.literal('command:error'),
  id: v.string(),
  error: v.string(),
  timestamp: v.number(),
});
export type CommandErrorEvent = v.InferOutput<typeof CommandErrorSchema>;

export const PongSchema = v.object({
  type: v.literal('pong'),
});
export type PongEvent = v.InferOutput<typeof PongSchema>;

export const FsListDirResponseSchema = v.object({
  type: v.literal('fs:list-dir-response'),
  requestId: v.string(),
  entries: v.array(
    v.object({
      name: v.string(),
      isDirectory: v.boolean(),
    })
  ),
  error: v.optional(v.string()),
});
export type FsListDirResponseEvent = v.InferOutput<typeof FsListDirResponseSchema>;

export const DaemonSyncSessionSchema = v.object({
  sessionId: v.string(),
  agentType: v.string(),
  mode: v.optional(v.picklist(['prompt', 'interactive']), 'prompt'),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  startedAt: v.number(),
  status: v.picklist(['active', 'ended', 'error']),
  exitCode: v.optional(v.number()),
  agentSessionId: v.optional(v.string()),
  resumable: v.boolean(),
  terminalChunks: v.array(TerminalChunkSchema),
  inputHistory: v.optional(
    v.array(
      v.object({
        text: v.string(),
        source: v.picklist(['cli', 'browser']),
        timestamp: v.number(),
      })
    )
  ),
});
export type DaemonSyncSession = v.InferOutput<typeof DaemonSyncSessionSchema>;

export const DaemonSyncSchema = v.object({
  type: v.literal('daemon:sync'),
  sessions: v.array(DaemonSyncSessionSchema),
});
export type DaemonSyncEvent = v.InferOutput<typeof DaemonSyncSchema>;

export const SessionOutputSchema = v.object({
  type: v.literal('session:output'),
  sessionId: SessionIdSchema,
  data: v.string(),
  chunkType: v.picklist(['text', 'thinking', 'tool_use', 'tool_result', 'status', 'error']),
  timestamp: v.number(),
});
export type SessionOutputEvent = v.InferOutput<typeof SessionOutputSchema>;

export const SessionSpawnFailedSchema = v.object({
  type: v.literal('session:spawn-failed'),
  sessionId: SessionIdSchema,
  error: v.string(),
  timestamp: v.number(),
});
export type SessionSpawnFailedEvent = v.InferOutput<typeof SessionSpawnFailedSchema>;

export const ShellEventSchema = v.variant('type', [
  DaemonHelloSchema,
  CommandOutputSchema,
  CommandDoneSchema,
  CommandErrorSchema,
  PongSchema,
  FsListDirResponseSchema,
  DaemonSyncSchema,
  SessionOutputSchema,
  SessionSpawnFailedSchema,
]);
export type ShellEvent = v.InferOutput<typeof ShellEventSchema>;

// Migrated from ws-schemas.ts — browser→daemon command
export const CommandRequestSchema = v.object({
  type: v.literal('command:request'),
  id: v.string(),
  command: v.string(),
  cwd: v.optional(v.string()),
});
export type CommandRequest = v.InferOutput<typeof CommandRequestSchema>;
