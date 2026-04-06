import * as v from 'valibot';

// ── Downstream (backend -> daemon) ──

export const CommandRequestSchema = v.object({
  type: v.literal('command:request'),
  id: v.string(),
  command: v.string(),
  cwd: v.optional(v.string()),
});
export type CommandRequest = v.InferOutput<typeof CommandRequestSchema>;

export const PingSchema = v.object({
  type: v.literal('ping'),
});

export const TerminalInputDownstreamSchema = v.object({
  type: v.literal('terminal:input'),
  sessionId: v.string(),
  data: v.string(),
});

export const TerminalResizeDownstreamSchema = v.object({
  type: v.literal('terminal:resize'),
  sessionId: v.string(),
  browserConnId: v.string(),
  cols: v.number(),
  rows: v.number(),
});

const TerminalBrowserDisconnectedSchema = v.object({
  type: v.literal('terminal:browser-disconnected'),
  sessionId: v.string(),
  browserConnId: v.string(),
});

const SessionSpawnRequestSchema = v.object({
  type: v.literal('session:spawn-request'),
  sessionId: v.string(),
  agentType: v.picklist(['claude', 'opencode', 'generic']),
  cwd: v.string(),
  cols: v.number(),
  rows: v.number(),
});

const SessionKillSchema = v.object({
  type: v.literal('session:kill'),
  sessionId: v.string(),
});

const FsListDirRequestSchema = v.object({
  type: v.literal('fs:list-dir'),
  requestId: v.string(),
  path: v.string(),
});

const SessionResumeRequestSchema = v.object({
  type: v.literal('session:resume-request'),
  sessionId: v.string(),
  claudeSessionId: v.string(),
  cwd: v.string(),
  cols: v.number(),
  rows: v.number(),
});

const SessionDeleteSchema = v.object({
  type: v.literal('session:delete'),
  sessionId: v.string(),
});

const SessionClearEndedSchema = v.object({
  type: v.literal('session:clear-ended'),
});

const TerminalChunksRequestSchema = v.object({
  type: v.literal('terminal:chunks-request'),
  requestId: v.string(),
  sessionId: v.string(),
});

export const DownstreamMessageSchema = v.variant('type', [
  CommandRequestSchema,
  PingSchema,
  TerminalInputDownstreamSchema,
  TerminalResizeDownstreamSchema,
  TerminalBrowserDisconnectedSchema,
  SessionSpawnRequestSchema,
  SessionKillSchema,
  FsListDirRequestSchema,
  SessionResumeRequestSchema,
  SessionDeleteSchema,
  SessionClearEndedSchema,
  TerminalChunksRequestSchema,
]);

// ── Upstream (daemon -> backend) ──

export const DaemonHelloSchema = v.object({
  type: v.literal('daemon:hello'),
  hostname: v.string(),
  pid: v.number(),
  version: v.string(),
  token: v.string(),
});

export const CommandOutputSchema = v.object({
  type: v.literal('command:output'),
  id: v.string(),
  stream: v.picklist(['stdout', 'stderr']),
  data: v.string(),
  timestamp: v.number(),
});
export type CommandOutput = v.InferOutput<typeof CommandOutputSchema>;

export const CommandDoneSchema = v.object({
  type: v.literal('command:done'),
  id: v.string(),
  exitCode: v.number(),
  timestamp: v.number(),
});
export type CommandDone = v.InferOutput<typeof CommandDoneSchema>;

export const CommandErrorSchema = v.object({
  type: v.literal('command:error'),
  id: v.string(),
  error: v.string(),
  timestamp: v.number(),
});
export type CommandError = v.InferOutput<typeof CommandErrorSchema>;

export const PongSchema = v.object({
  type: v.literal('pong'),
});

export const TerminalOutputUpstreamSchema = v.object({
  type: v.literal('terminal:output'),
  sessionId: v.string(),
  data: v.string(),
  timestamp: v.number(),
});

// Upstream schema docs — messages constructed inline in main.ts
const _TerminalInputEchoSchema = v.object({
  type: v.literal('terminal:input-echo'),
  sessionId: v.string(),
  text: v.string(),
  source: v.picklist(['cli', 'browser']),
  timestamp: v.number(),
});

const _SessionClaudeIdDetectedSchema = v.object({
  type: v.literal('session:claude-id-detected'),
  sessionId: v.string(),
  claudeSessionId: v.string(),
  timestamp: v.number(),
});

// ── Sync message (daemon -> backend on reconnect) ──

const DaemonSyncSessionSchema = v.object({
  sessionId: v.string(),
  agentType: v.picklist(['claude', 'opencode', 'generic']),
  mode: v.optional(v.picklist(['prompt', 'interactive']), 'prompt'),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  startedAt: v.number(),
  status: v.picklist(['active', 'ended', 'error']),
  exitCode: v.optional(v.number()),
  claudeSessionId: v.optional(v.string()),
  terminalChunks: v.array(
    v.object({
      data: v.string(),
      timestamp: v.number(),
      seq: v.number(),
    })
  ),
});
// daemon:sync schema — defines the sync message sent on reconnect.
// Not imported directly (message is constructed in main.ts), but documents the contract.
const _DaemonSyncSchema = v.object({
  type: v.literal('daemon:sync'),
  sessions: v.array(DaemonSyncSessionSchema),
});
