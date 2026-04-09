import * as v from 'valibot';
import { AgentTypeSchema } from '#shared/kernel/session/agent-type';
import { TerminalChunkSchema } from '#shared/kernel/session/events';
import { SessionIdSchema } from '#shared/kernel/session/session-id';

const DaemonHelloSchema = v.object({
  type: v.literal('daemon:hello'),
  hostname: v.string(),
  pid: v.number(),
  version: v.string(),
});

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

const PongSchema = v.object({
  type: v.literal('pong'),
});

const FsListDirResponseSchema = v.object({
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

const DaemonSyncSessionSchema = v.object({
  sessionId: v.string(),
  agentType: AgentTypeSchema,
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

const DaemonSyncSchema = v.object({
  type: v.literal('daemon:sync'),
  sessions: v.array(DaemonSyncSessionSchema),
});

export const SessionOutputSchema = v.object({
  type: v.literal('session:output'),
  sessionId: SessionIdSchema,
  data: v.string(),
  chunkType: v.picklist(['text', 'thinking', 'tool_use', 'tool_result', 'status', 'error']),
  timestamp: v.number(),
});

export const SessionSpawnFailedSchema = v.object({
  type: v.literal('session:spawn-failed'),
  sessionId: SessionIdSchema,
  error: v.string(),
  timestamp: v.number(),
});

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

// Migrated from ws-schemas.ts — browser→daemon command
export const CommandRequestSchema = v.object({
  type: v.literal('command:request'),
  id: v.string(),
  command: v.string(),
  cwd: v.optional(v.string()),
});
export type CommandRequest = v.InferOutput<typeof CommandRequestSchema>;
