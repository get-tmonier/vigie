import * as v from 'valibot';

export const SSECommandOutputSchema = v.object({
  type: v.literal('command:output'),
  id: v.string(),
  stream: v.picklist(['stdout', 'stderr']),
  data: v.string(),
  timestamp: v.number(),
});
export type SSECommandOutput = v.InferOutput<typeof SSECommandOutputSchema>;

export const SSECommandDoneSchema = v.object({
  type: v.literal('command:done'),
  id: v.string(),
  exitCode: v.number(),
  timestamp: v.number(),
});
export type SSECommandDone = v.InferOutput<typeof SSECommandDoneSchema>;

export const SSECommandErrorSchema = v.object({
  type: v.literal('command:error'),
  id: v.string(),
  error: v.string(),
  timestamp: v.number(),
});
export type SSECommandError = v.InferOutput<typeof SSECommandErrorSchema>;

export const SSEDaemonConnectedSchema = v.object({
  type: v.literal('daemon:connected'),
  daemonId: v.string(),
  hostname: v.string(),
  timestamp: v.number(),
});
export type SSEDaemonConnected = v.InferOutput<typeof SSEDaemonConnectedSchema>;

export const SSEDaemonDisconnectedSchema = v.object({
  type: v.literal('daemon:disconnected'),
  daemonId: v.string(),
  hostname: v.string(),
  timestamp: v.number(),
});
export type SSEDaemonDisconnected = v.InferOutput<typeof SSEDaemonDisconnectedSchema>;

// ── Session SSE events ──

export const SSESessionStartedSchema = v.object({
  type: v.literal('session:started'),
  daemonId: v.string(),
  sessionId: v.string(),
  agentType: v.picklist(['claude', 'opencode', 'generic']),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  timestamp: v.number(),
});
export type SSESessionStarted = v.InferOutput<typeof SSESessionStartedSchema>;

export const SSESessionOutputSchema = v.object({
  type: v.literal('session:output'),
  daemonId: v.string(),
  sessionId: v.string(),
  data: v.string(),
  chunkType: v.picklist(['text', 'thinking', 'tool_use', 'tool_result', 'status', 'error']),
  timestamp: v.number(),
});
export type SSESessionOutput = v.InferOutput<typeof SSESessionOutputSchema>;

export const SSESessionEndedSchema = v.object({
  type: v.literal('session:ended'),
  daemonId: v.string(),
  sessionId: v.string(),
  exitCode: v.number(),
  timestamp: v.number(),
});
export type SSESessionEnded = v.InferOutput<typeof SSESessionEndedSchema>;

export const SSESessionErrorSchema = v.object({
  type: v.literal('session:error'),
  daemonId: v.string(),
  sessionId: v.string(),
  error: v.string(),
  timestamp: v.number(),
});
export type SSESessionError = v.InferOutput<typeof SSESessionErrorSchema>;

export const SSEEventSchema = v.variant('type', [
  SSECommandOutputSchema,
  SSECommandDoneSchema,
  SSECommandErrorSchema,
  SSEDaemonConnectedSchema,
  SSEDaemonDisconnectedSchema,
  SSESessionStartedSchema,
  SSESessionOutputSchema,
  SSESessionEndedSchema,
  SSESessionErrorSchema,
]);
export type SSEEvent = v.InferOutput<typeof SSEEventSchema>;
