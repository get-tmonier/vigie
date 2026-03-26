import { homedir } from 'node:os';
import { join } from 'node:path';
import * as v from 'valibot';

const CliEnvSchema = v.object({
  VIGIE_API_URL: v.optional(v.string(), 'ws://localhost:3001/ws/daemon'),
  VIGIE_APP_URL: v.optional(v.string(), 'http://localhost:3000'),
  VIGIE_TOKEN: v.optional(v.string()),
});

export const config = v.parse(CliEnvSchema, process.env);

export const VIGIE_HOME = join(homedir(), '.vigie');
