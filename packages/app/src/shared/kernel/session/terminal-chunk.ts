import * as v from 'valibot';

export const TerminalChunkSchema = v.object({
  data: v.string(),
  timestamp: v.number(),
  seq: v.number(),
});
