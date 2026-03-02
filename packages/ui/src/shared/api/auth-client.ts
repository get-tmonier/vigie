import { apiKeyClient } from '@better-auth/api-key/client';
import { createAuthClient } from 'better-auth/react';
import { env } from '#shared/config/env';

export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
  plugins: [apiKeyClient()],
});

export const { useSession, signIn, signOut } = authClient;
