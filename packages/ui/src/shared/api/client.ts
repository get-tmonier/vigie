import type { BaseIssue, BaseSchema, InferOutput } from 'valibot';
import { parse } from 'valibot';
import { env } from '../config/env';

export const API_BASE = env.VITE_API_URL;

interface FetchWithSchemaOptions<S extends BaseSchema<unknown, unknown, BaseIssue<unknown>>>
  extends RequestInit {
  schema: S;
}

export async function apiFetch<S extends BaseSchema<unknown, unknown, BaseIssue<unknown>>>(
  path: string,
  options: FetchWithSchemaOptions<S>
): Promise<InferOutput<S>>;
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>;
export async function apiFetch(
  path: string,
  options?: RequestInit & { schema?: BaseSchema<unknown, unknown, BaseIssue<unknown>> }
) {
  const schema = options && 'schema' in options ? options.schema : undefined;
  const init = options ? { ...options } : undefined;
  if (init && 'schema' in init) {
    delete (init as Record<string, unknown>).schema;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  const data = await res.json();
  if (schema) {
    return parse(schema, data);
  }
  return data;
}
