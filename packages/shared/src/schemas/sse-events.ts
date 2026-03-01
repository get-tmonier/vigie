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

export const SSEEventSchema = v.variant('type', [
  SSECommandOutputSchema,
  SSECommandDoneSchema,
  SSECommandErrorSchema,
  SSEDaemonConnectedSchema,
  SSEDaemonDisconnectedSchema,
]);
export type SSEEvent = v.InferOutput<typeof SSEEventSchema>;
