import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { type AgentType, AgentTypeSchema } from '../agent-type';

describe('AgentTypeSchema', () => {
  it('accepts claude', () => {
    const result = v.parse(AgentTypeSchema, 'claude');
    expect(result).toBe('claude');
    // Verify type compatibility
    const _: AgentType = result;
  });

  it('rejects unknown agents', () => {
    expect(() => v.parse(AgentTypeSchema, 'opencode')).toThrow();
  });
});
