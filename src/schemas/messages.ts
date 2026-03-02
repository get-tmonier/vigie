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

export const DownstreamMessageSchema = v.variant('type', [CommandRequestSchema, PingSchema]);

// ── Upstream (daemon -> backend) ──

export const DaemonHelloSchema = v.object({
  type: v.literal('daemon:hello'),
  hostname: v.string(),
  pid: v.number(),
  version: v.string(),
  token: v.string(),
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
