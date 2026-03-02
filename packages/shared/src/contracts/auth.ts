import { initContract } from '@ts-rest/core';

const c = initContract();

export const authContract = c.router({
  listApiKeys: {
    method: 'GET',
    path: '/api/keys',
    responses: {
      200: c.type<{
        apiKeys: Array<{
          id: string;
          name: string | null;
          prefix: string | null;
          createdAt: string;
        }>;
      }>(),
      401: c.type<{ error: string }>(),
    },
    summary: 'List API keys for the authenticated user',
  },
  createApiKey: {
    method: 'POST',
    path: '/api/keys',
    body: c.type<{ name: string }>(),
    responses: {
      201: c.type<{
        id: string;
        name: string | null;
        prefix: string | null;
        createdAt: string;
        key: string;
      }>(),
      401: c.type<{ error: string }>(),
    },
    summary: 'Create a new API key',
  },
  deleteApiKey: {
    method: 'DELETE',
    path: '/api/keys/:keyId',
    body: null,
    responses: {
      200: c.type<{ success: boolean }>(),
      401: c.type<{ error: string }>(),
    },
    summary: 'Delete an API key',
  },
});
