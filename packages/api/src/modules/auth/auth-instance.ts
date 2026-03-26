import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { pool } from '#database/client';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const auth = betterAuth({
  database: pool,
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  trustedOrigins: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [],
  socialProviders: {
    github: {
      clientId: requireEnv('GITHUB_CLIENT_ID'),
      clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
    },
  },
  plugins: [
    bearer(),
    apiKey({
      defaultPrefix: 'vigie_',
      maximumNameLength: 64,
      rateLimit: { enabled: false },
    }),
  ],
});
