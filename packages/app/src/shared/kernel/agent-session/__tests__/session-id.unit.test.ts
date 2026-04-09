import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { type SessionId, SessionIdSchema } from '../session-id';

describe('SessionIdSchema', () => {
  it('parses a string into a branded SessionId', () => {
    const result = v.parse(SessionIdSchema, 'abc-123');
    const _: SessionId = result;
    expect(String(result)).toBe('abc-123');
  });

  it('rejects non-strings', () => {
    expect(() => v.parse(SessionIdSchema, 42)).toThrow();
  });
});
