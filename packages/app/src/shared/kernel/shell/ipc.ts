import * as v from 'valibot';
import { AgentTypeSchema } from '#shared/kernel/agent-session/agent-type';
import { SessionErrorSchema } from '#shared/kernel/agent-session/events';
import { SessionIdSchema } from '#shared/kernel/agent-session/session-id';
import { SessionOutputSchema, SessionSpawnFailedSchema } from '#shared/kernel/shell/events';

// ── Session → Daemon ──

export const SessionRegisterSchema = v.object({
  type: v.literal('session:register'),
  sessionId: SessionIdSchema,
  agentType: AgentTypeSchema,
  mode: v.optional(v.picklist(['prompt', 'interactive']), 'prompt'),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  gitRemoteUrl: v.optional(v.string()),
  repoName: v.optional(v.string()),
});

const SessionAgentIdSchema = v.object({
  type: v.literal('session:agent-id'),
  sessionId: SessionIdSchema,
  agentSessionId: v.string(),
});

export const SessionTerminalOutputSchema = v.object({
  type: v.literal('session:terminal-output'),
  sessionId: SessionIdSchema,
  data: v.string(),
  timestamp: v.number(),
});

export const SessionSpawnInteractiveSchema = v.object({
  type: v.literal('session:spawn-interactive'),
  sessionId: SessionIdSchema,
  agentType: AgentTypeSchema,
  cwd: v.string(),
  cols: v.number(),
  rows: v.number(),
  gitBranch: v.optional(v.string()),
  gitRemoteUrl: v.optional(v.string()),
  repoName: v.optional(v.string()),
});

export const SessionStdinSchema = v.object({
  type: v.literal('session:stdin'),
  sessionId: SessionIdSchema,
  data: v.string(),
});

export const SessionCliResizeSchema = v.object({
  type: v.literal('session:cli-resize'),
  sessionId: SessionIdSchema,
  cols: v.number(),
  rows: v.number(),
});

export const SessionDetachSchema = v.object({
  type: v.literal('session:detach'),
  sessionId: SessionIdSchema,
});

export const SessionAttachSchema = v.object({
  type: v.literal('session:attach'),
  sessionId: SessionIdSchema,
  cols: v.number(),
  rows: v.number(),
});

const SessionResumeSchema = v.object({
  type: v.literal('session:resume'),
  sessionId: SessionIdSchema,
  agentSessionId: v.string(),
  cwd: v.string(),
  cols: v.number(),
  rows: v.number(),
  gitBranch: v.optional(v.string()),
  gitRemoteUrl: v.optional(v.string()),
  repoName: v.optional(v.string()),
});

export const SessionDoneSchema = v.object({
  type: v.literal('session:done'),
  sessionId: SessionIdSchema,
  exitCode: v.number(),
  timestamp: v.number(),
});

export const SessionDeregisterSchema = v.object({
  type: v.literal('session:deregister'),
  sessionId: SessionIdSchema,
});

export const SessionToDaemonSchema = v.variant('type', [
  SessionRegisterSchema,
  SessionOutputSchema,
  SessionDoneSchema,
  SessionErrorSchema,
  SessionDeregisterSchema,
  SessionAgentIdSchema,
  SessionTerminalOutputSchema,
  SessionSpawnInteractiveSchema,
  SessionStdinSchema,
  SessionCliResizeSchema,
  SessionDetachSchema,
  SessionAttachSchema,
  SessionResumeSchema,
]);
export type SessionToDaemon = v.InferOutput<typeof SessionToDaemonSchema>;

// ── Daemon → Session ──

export const SessionRegisteredSchema = v.object({
  type: v.literal('session:registered'),
  sessionId: SessionIdSchema,
});

export const SessionErrorResponseSchema = v.object({
  type: v.literal('session:error-response'),
  sessionId: SessionIdSchema,
  error: v.string(),
});

export const SessionTerminalInputSchema = v.object({
  type: v.literal('session:terminal-input'),
  sessionId: SessionIdSchema,
  data: v.string(),
});

export const SessionTerminalResizeSchema = v.object({
  type: v.literal('session:terminal-resize'),
  sessionId: SessionIdSchema,
  cols: v.number(),
  rows: v.number(),
});

export const SessionSpawnedSchema = v.object({
  type: v.literal('session:spawned'),
  sessionId: SessionIdSchema,
  pid: v.number(),
  ptyCols: v.optional(v.number()),
  ptyRows: v.optional(v.number()),
  forcedResize: v.optional(v.boolean()),
});

const SessionReplayCompleteSchema = v.object({
  type: v.literal('session:replay-complete'),
  sessionId: SessionIdSchema,
});

const SessionPtyResizedSchema = v.object({
  type: v.literal('session:pty-resized'),
  sessionId: SessionIdSchema,
  ptyCols: v.number(),
  ptyRows: v.number(),
});

export const SessionPtyOutputSchema = v.object({
  type: v.literal('session:pty-output'),
  sessionId: SessionIdSchema,
  data: v.string(),
});

export const SessionPtyExitedSchema = v.object({
  type: v.literal('session:pty-exited'),
  sessionId: SessionIdSchema,
  exitCode: v.number(),
});

export const DaemonToSessionSchema = v.variant('type', [
  SessionRegisteredSchema,
  SessionErrorResponseSchema,
  SessionTerminalInputSchema,
  SessionTerminalResizeSchema,
  SessionSpawnedSchema,
  SessionSpawnFailedSchema,
  SessionPtyOutputSchema,
  SessionPtyExitedSchema,
  SessionReplayCompleteSchema,
  SessionPtyResizedSchema,
]);
export type DaemonToSession = v.InferOutput<typeof DaemonToSessionSchema>;
