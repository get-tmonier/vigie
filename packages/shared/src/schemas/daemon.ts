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
export type Ping = v.InferOutput<typeof PingSchema>;

export const DownstreamMessageSchema = v.variant('type', [CommandRequestSchema, PingSchema]);
export type DownstreamMessage = v.InferOutput<typeof DownstreamMessageSchema>;

// ── Upstream (daemon -> backend) ──

export const DaemonHelloSchema = v.object({
  type: v.literal('daemon:hello'),
  hostname: v.string(),
  pid: v.number(),
  version: v.string(),
});
export type DaemonHello = v.InferOutput<typeof DaemonHelloSchema>;

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
export type Pong = v.InferOutput<typeof PongSchema>;

// ── Session messages (daemon -> backend) ──

export const SessionStartedSchema = v.object({
  type: v.literal('session:started'),
  sessionId: v.string(),
  agentType: v.picklist(['claude', 'opencode', 'generic']),
  mode: v.optional(v.picklist(['prompt', 'interactive']), 'prompt'),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  timestamp: v.number(),
});
export type SessionStarted = v.InferOutput<typeof SessionStartedSchema>;

export const SessionOutputSchema = v.object({
  type: v.literal('session:output'),
  sessionId: v.string(),
  data: v.string(),
  chunkType: v.picklist(['text', 'thinking', 'tool_use', 'tool_result', 'status', 'error']),
  timestamp: v.number(),
});
export type SessionOutput = v.InferOutput<typeof SessionOutputSchema>;

export const SessionEndedSchema = v.object({
  type: v.literal('session:ended'),
  sessionId: v.string(),
  exitCode: v.number(),
  timestamp: v.number(),
});
export type SessionEnded = v.InferOutput<typeof SessionEndedSchema>;

export const SessionErrorUpstreamSchema = v.object({
  type: v.literal('session:error'),
  sessionId: v.string(),
  error: v.string(),
  timestamp: v.number(),
});
export type SessionErrorUpstream = v.InferOutput<typeof SessionErrorUpstreamSchema>;

export const TerminalOutputSchema = v.object({
  type: v.literal('terminal:output'),
  sessionId: v.string(),
  data: v.string(),
  timestamp: v.number(),
});
export type TerminalOutput = v.InferOutput<typeof TerminalOutputSchema>;

// ── Downstream terminal messages (backend -> daemon) ──

export const TerminalInputSchema = v.object({
  type: v.literal('terminal:input'),
  sessionId: v.string(),
  data: v.string(),
});
export type TerminalInput = v.InferOutput<typeof TerminalInputSchema>;

export const TerminalResizeSchema = v.object({
  type: v.literal('terminal:resize'),
  sessionId: v.string(),
  cols: v.number(),
  rows: v.number(),
});
export type TerminalResize = v.InferOutput<typeof TerminalResizeSchema>;

export const UpstreamMessageSchema = v.variant('type', [
  DaemonHelloSchema,
  CommandOutputSchema,
  CommandDoneSchema,
  CommandErrorSchema,
  PongSchema,
  SessionStartedSchema,
  SessionOutputSchema,
  SessionEndedSchema,
  SessionErrorUpstreamSchema,
  TerminalOutputSchema,
]);
export type UpstreamMessage = v.InferOutput<typeof UpstreamMessageSchema>;

export const DownstreamTerminalMessageSchema = v.variant('type', [
  TerminalInputSchema,
  TerminalResizeSchema,
]);
export type DownstreamTerminalMessage = v.InferOutput<typeof DownstreamTerminalMessageSchema>;
