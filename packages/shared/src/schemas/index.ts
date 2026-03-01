import * as v from 'valibot';

export const HealthResponseSchema = v.object({
  status: v.string(),
});

export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;
