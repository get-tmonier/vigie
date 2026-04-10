import * as v from 'valibot';
import { AgentTypeSchema } from '#shared/kernel/session/agent-type';

export const AgentSessionSchema = v.object({
  id: v.string(),
  agentType: AgentTypeSchema,
  mode: v.string(),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  status: v.picklist([
    'registering',
    'active',
    'paused',
    'ended',
    'error',
    'abandoned',
    'killed',
    'archived',
  ]),
  exitCode: v.optional(v.number()),
  agentSessionId: v.optional(v.string()),
  resumable: v.optional(v.boolean()),
});
export type AgentSession = v.InferOutput<typeof AgentSessionSchema>;

export const SpawnSessionRequestSchema = v.object({
  agentType: v.optional(AgentTypeSchema),
  cwd: v.optional(v.string()),
  cols: v.optional(v.number()),
  rows: v.optional(v.number()),
});
