import * as v from 'valibot';
import { SessionEventSchema } from '#shared/kernel/agent-session/events';
import { ShellEventSchema } from '#shared/kernel/shell/events';

export type { SessionEvent } from '#shared/kernel/agent-session/events';
export type { ShellEvent } from '#shared/kernel/shell/events';

export const VigieEventSchema = v.union([SessionEventSchema, ShellEventSchema]);
export type VigieEvent = v.InferOutput<typeof VigieEventSchema>;
