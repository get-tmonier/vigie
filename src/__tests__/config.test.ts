import { describe, expect, it } from 'bun:test';
import { config } from '../config.js';

describe('config defaults', () => {
  it('TMONIER_API_URL defaults to ws://localhost:3001/ws/daemon', () => {
    expect(config.TMONIER_API_URL).toBe('ws://localhost:3001/ws/daemon');
  });

  it('TMONIER_APP_URL defaults to http://localhost:3000', () => {
    expect(config.TMONIER_APP_URL).toBe('http://localhost:3000');
  });

  it('TMONIER_TOKEN is undefined by default', () => {
    expect(config.TMONIER_TOKEN).toBeUndefined();
  });
});
