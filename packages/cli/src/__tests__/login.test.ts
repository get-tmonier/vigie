import { describe, expect, it } from 'bun:test';
import { createCallbackHandler, escapeHtml } from '../modules/auth/commands/login.command.js';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello" & \'world\'')).toBe('&quot;hello&quot; &amp; &#39;world&#39;');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('createCallbackHandler', () => {
  it('returns 404 for non-callback paths', () => {
    const handler = createCallbackHandler('state-123');
    const req = new Request('http://localhost/other');
    const res = handler(req);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
  });

  it('returns 400 for state mismatch', () => {
    const handler = createCallbackHandler('state-123');
    const req = new Request('http://localhost/callback?state=wrong&key=abc');
    const res = handler(req);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('returns 400 for error parameter', () => {
    const handler = createCallbackHandler('state-123');
    const req = new Request('http://localhost/callback?state=state-123&error=denied');
    const res = handler(req);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('returns 400 when key is missing', () => {
    const handler = createCallbackHandler('state-123');
    const req = new Request('http://localhost/callback?state=state-123');
    const res = handler(req);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('returns key object on success', () => {
    const handler = createCallbackHandler('state-123');
    const req = new Request('http://localhost/callback?state=state-123&key=tmonier_abc');
    const res = handler(req);
    expect(res).not.toBeInstanceOf(Response);
    expect((res as { key: string }).key).toBe('tmonier_abc');
  });
});
