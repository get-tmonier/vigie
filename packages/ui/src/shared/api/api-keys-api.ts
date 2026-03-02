import { apiFetch } from '#shared/api/client';

interface ApiKeyCreated {
  id: string;
  name: string | null;
  prefix: string | null;
  createdAt: string;
  key: string;
}

interface ApiKeyEntry {
  id: string;
  name: string | null;
  prefix: string | null;
  createdAt: string;
}

export async function listApiKeys(): Promise<ApiKeyEntry[]> {
  const res = await apiFetch<{ apiKeys: ApiKeyEntry[] }>('/api/keys', { method: 'GET' });
  return res.apiKeys;
}

export async function deleteApiKey(keyId: string): Promise<void> {
  await apiFetch(`/api/keys/${keyId}`, { method: 'DELETE' });
}

export async function createApiKey(name: string): Promise<ApiKeyCreated> {
  return apiFetch('/api/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
