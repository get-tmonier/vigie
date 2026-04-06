import * as v from 'valibot';

export const AgentSessionSchema = v.object({
  id: v.string(),
  agentType: v.string(),
  mode: v.string(),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  status: v.picklist(['registering', 'active', 'ended', 'error']),
  exitCode: v.optional(v.number()),
  claudeSessionId: v.optional(v.string()),
  resumable: v.optional(v.boolean()),
});
export type AgentSession = v.InferOutput<typeof AgentSessionSchema>;

export const SpawnSessionRequestSchema = v.object({
  agentType: v.optional(v.string()),
  cwd: v.optional(v.string()),
  cols: v.optional(v.number()),
  rows: v.optional(v.number()),
});
