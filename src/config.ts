import * as v from 'valibot';

const CliEnvSchema = v.object({
  TMONIER_API_URL: v.optional(v.string(), 'ws://localhost:3001/ws/daemon'),
});

export const config = v.parse(CliEnvSchema, process.env);
