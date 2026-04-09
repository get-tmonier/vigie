import * as v from 'valibot';

export const AgentTypeSchema = v.picklist(['claude']);
export type AgentType = v.InferOutput<typeof AgentTypeSchema>;
