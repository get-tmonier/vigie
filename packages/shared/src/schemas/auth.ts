import * as v from 'valibot';

export const ApiKeyCreateRequestSchema = v.object({
  name: v.string(),
});

export type ApiKeyCreateRequest = v.InferOutput<typeof ApiKeyCreateRequestSchema>;

export const ApiKeyResponseSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
  prefix: v.nullable(v.string()),
  createdAt: v.string(),
});

export type ApiKeyResponse = v.InferOutput<typeof ApiKeyResponseSchema>;

export const ApiKeyCreatedResponseSchema = v.object({
  ...ApiKeyResponseSchema.entries,
  key: v.string(),
});

export type ApiKeyCreatedResponse = v.InferOutput<typeof ApiKeyCreatedResponseSchema>;
