import * as v from 'valibot';

const EnvSchema = v.object({
  VITE_API_URL: v.optional(v.string(), 'http://localhost:3001'),
});

export const env = v.parse(EnvSchema, typeof import.meta !== 'undefined' ? import.meta.env : {});
