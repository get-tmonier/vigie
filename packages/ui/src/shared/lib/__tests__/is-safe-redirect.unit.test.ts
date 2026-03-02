import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { isSafeRedirect } from '../is-safe-redirect';

describe('isSafeRedirect', () => {
  const originalWindow = globalThis.window;

  beforeAll(() => {
    globalThis.window = {
      location: { origin: 'https://app.tmonier.com' },
    } as unknown as Window & typeof globalThis;
  });

  afterAll(() => {
    globalThis.window = originalWindow;
  });

  it('accepts same-origin path', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true);
  });

  it('accepts same-origin absolute URL', () => {
    expect(isSafeRedirect('https://app.tmonier.com/settings')).toBe(true);
  });

  it('accepts localhost callback URL', () => {
    expect(isSafeRedirect('http://127.0.0.1:9876/callback')).toBe(true);
  });

  it('rejects external URL', () => {
    expect(isSafeRedirect('https://evil.com/steal')).toBe(false);
  });

  it('treats empty string as same-origin (resolves to base URL)', () => {
    expect(isSafeRedirect('')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(isSafeRedirect('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
});
