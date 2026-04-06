import { describe, expect, it } from 'bun:test';
import { colors, fonts } from '../index';

describe('tokens', () => {
  it('exports colors', () => {
    expect(typeof colors).toBe('object');
    expect(colors).not.toBeNull();
  });

  it('exports fonts', () => {
    expect(typeof fonts).toBe('object');
    expect(fonts).not.toBeNull();
  });
});
