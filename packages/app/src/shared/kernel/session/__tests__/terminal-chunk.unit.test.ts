import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { TerminalChunkSchema } from '../terminal-chunk';

describe('TerminalChunkSchema', () => {
  it('parses chunk without type field', () => {
    const result = v.parse(TerminalChunkSchema, {
      data: 'base64data',
      timestamp: 1234567890,
      seq: 1,
    });
    expect(result.seq).toBe(1);
  });
});
