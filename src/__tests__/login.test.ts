import { describe, expect, it } from 'bun:test';
import { createCallbackHandler, escapeHtml } from '../commands/login.js';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('passes through clean strings', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('createCallbackHandler', () => {
  const STATE = 'test-state-123';
  const handler = createCallbackHandler(STATE);

  function req(path: string, params: Record<string, string> = {}) {
    const url = new URL(path, 'http://localhost');
    for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
    return new Request(url.toString());
  }

  it('returns 404 for non-/callback paths', () => {
    const res = handler(req('/other'));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
  });

  it('returns 400 on state mismatch (CSRF)', () => {
    const res = handler(req('/callback', { state: 'wrong', key: 'k' }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('returns 400 when error param present', () => {
    const res = handler(req('/callback', { state: STATE, error: 'denied' }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('returns 400 when key is missing', () => {
    const res = handler(req('/callback', { state: STATE }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('returns { key } on valid callback', () => {
    const res = handler(req('/callback', { state: STATE, key: 'tmonier_abc' }));
    expect(res).not.toBeInstanceOf(Response);
    expect(res).toEqual({ key: 'tmonier_abc' });
  });

  it('HTML-escapes error messages in response body', async () => {
    const res = handler(req('/callback', { state: STATE, error: '<img onerror=alert(1)>' }));
    const body = await (res as Response).text();
    expect(body).toContain('&lt;img onerror=alert(1)&gt;');
    expect(body).not.toContain('<img onerror');
  });
});
