import * as v from 'valibot';

// ── Session → Daemon ──

export const SessionRegisterSchema = v.object({
  type: v.literal('session:register'),
  sessionId: v.string(),
  agentType: v.picklist(['claude', 'opencode', 'generic']),
  mode: v.optional(v.picklist(['prompt', 'interactive']), 'prompt'),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  gitRemoteUrl: v.optional(v.string()),
  repoName: v.optional(v.string()),
});

export const SessionOutputSchema = v.object({
  type: v.literal('session:output'),
  sessionId: v.string(),
  data: v.string(),
  chunkType: v.picklist(['text', 'thinking', 'tool_use', 'tool_result', 'status', 'error']),
  timestamp: v.number(),
});

export const SessionDoneSchema = v.object({
  type: v.literal('session:done'),
  sessionId: v.string(),
  exitCode: v.number(),
  timestamp: v.number(),
});

export const SessionErrorSchema = v.object({
  type: v.literal('session:error'),
  sessionId: v.string(),
  error: v.string(),
  timestamp: v.number(),
});

export const SessionDeregisterSchema = v.object({
  type: v.literal('session:deregister'),
  sessionId: v.string(),
});

const SessionClaudeIdSchema = v.object({
  type: v.literal('session:claude-id'),
  sessionId: v.string(),
  claudeSessionId: v.string(),
});

export const SessionTerminalOutputSchema = v.object({
  type: v.literal('session:terminal-output'),
  sessionId: v.string(),
  data: v.string(),
  timestamp: v.number(),
});

export const SessionSpawnInteractiveSchema = v.object({
  type: v.literal('session:spawn-interactive'),
  sessionId: v.string(),
  agentType: v.picklist(['claude', 'opencode', 'generic']),
  cwd: v.string(),
  cols: v.number(),
  rows: v.number(),
  gitBranch: v.optional(v.string()),
  gitRemoteUrl: v.optional(v.string()),
  repoName: v.optional(v.string()),
});

export const SessionStdinSchema = v.object({
  type: v.literal('session:stdin'),
  sessionId: v.string(),
  data: v.string(),
});

export const SessionCliResizeSchema = v.object({
  type: v.literal('session:cli-resize'),
  sessionId: v.string(),
  cols: v.number(),
  rows: v.number(),
});

export const SessionDetachSchema = v.object({
  type: v.literal('session:detach'),
  sessionId: v.string(),
});

export const SessionAttachSchema = v.object({
  type: v.literal('session:attach'),
  sessionId: v.string(),
  cols: v.number(),
  rows: v.number(),
});

const SessionResumeSchema = v.object({
  type: v.literal('session:resume'),
  sessionId: v.string(),
  claudeSessionId: v.string(),
  cwd: v.string(),
  cols: v.number(),
  rows: v.number(),
  gitBranch: v.optional(v.string()),
  gitRemoteUrl: v.optional(v.string()),
  repoName: v.optional(v.string()),
});

export const SessionToDaemonSchema = v.variant('type', [
  SessionRegisterSchema,
  SessionOutputSchema,
  SessionDoneSchema,
  SessionErrorSchema,
  SessionDeregisterSchema,
  SessionClaudeIdSchema,
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
  sessionId: v.string(),
});

export const SessionErrorResponseSchema = v.object({
  type: v.literal('session:error-response'),
  sessionId: v.string(),
  error: v.string(),
});

export const SessionTerminalInputSchema = v.object({
  type: v.literal('session:terminal-input'),
  sessionId: v.string(),
  data: v.string(),
});

export const SessionTerminalResizeSchema = v.object({
  type: v.literal('session:terminal-resize'),
  sessionId: v.string(),
  cols: v.number(),
  rows: v.number(),
});

export const SessionSpawnedSchema = v.object({
  type: v.literal('session:spawned'),
  sessionId: v.string(),
  pid: v.number(),
  ptyCols: v.optional(v.number()),
  ptyRows: v.optional(v.number()),
  // true when daemon forced a PTY resize to CLI dims (no browser connected)
  // client must wait ~300ms for Claude Code to redraw before activating renderer
  forcedResize: v.optional(v.boolean()),
});

const SessionReplayCompleteSchema = v.object({
  type: v.literal('session:replay-complete'),
  sessionId: v.string(),
});

const SessionPtyResizedSchema = v.object({
  type: v.literal('session:pty-resized'),
  sessionId: v.string(),
  ptyCols: v.number(),
  ptyRows: v.number(),
});

export const SessionSpawnFailedSchema = v.object({
  type: v.literal('session:spawn-failed'),
  sessionId: v.string(),
  error: v.string(),
});

export const SessionPtyOutputSchema = v.object({
  type: v.literal('session:pty-output'),
  sessionId: v.string(),
  data: v.string(),
});

export const SessionPtyExitedSchema = v.object({
  type: v.literal('session:pty-exited'),
  sessionId: v.string(),
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
