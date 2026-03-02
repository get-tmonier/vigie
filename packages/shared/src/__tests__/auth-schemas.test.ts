import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  ApiKeyCreatedResponseSchema,
  ApiKeyCreateRequestSchema,
  ApiKeyResponseSchema,
} from '../schemas/auth';

describe('ApiKeyCreateRequestSchema', () => {
  it('accepts valid name', () => {
    const result = v.parse(ApiKeyCreateRequestSchema, { name: 'test' });
    expect(result.name).toBe('test');
  });

  it('rejects empty object', () => {
    expect(() => v.parse(ApiKeyCreateRequestSchema, {})).toThrow();
  });

  it('rejects non-string name', () => {
    expect(() => v.parse(ApiKeyCreateRequestSchema, { name: 123 })).toThrow();
  });
});

describe('ApiKeyResponseSchema', () => {
  it('accepts valid shape with non-null fields', () => {
    const result = v.parse(ApiKeyResponseSchema, {
      id: 'key-1',
      name: 'My Key',
      prefix: 'tmonier_',
      createdAt: '2025-01-01T00:00:00Z',
    });
    expect(result.id).toBe('key-1');
    expect(result.name).toBe('My Key');
  });

  it('accepts nullable fields as null', () => {
    const result = v.parse(ApiKeyResponseSchema, {
      id: 'key-1',
      name: null,
      prefix: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    expect(result.name).toBeNull();
    expect(result.prefix).toBeNull();
  });

  it('rejects missing id', () => {
    expect(() =>
      v.parse(ApiKeyResponseSchema, {
        name: 'test',
        prefix: 'tmonier_',
        createdAt: '2025-01-01T00:00:00Z',
      })
    ).toThrow();
  });
});

describe('ApiKeyCreatedResponseSchema', () => {
  it('accepts valid shape with key field', () => {
    const result = v.parse(ApiKeyCreatedResponseSchema, {
      id: 'key-1',
      name: 'My Key',
      prefix: 'tmonier_',
      createdAt: '2025-01-01T00:00:00Z',
      key: 'tmonier_abc123',
    });
    expect(result.key).toBe('tmonier_abc123');
  });

  it('rejects missing key field', () => {
    expect(() =>
      v.parse(ApiKeyCreatedResponseSchema, {
        id: 'key-1',
        name: 'My Key',
        prefix: 'tmonier_',
        createdAt: '2025-01-01T00:00:00Z',
      })
    ).toThrow();
  });
});
