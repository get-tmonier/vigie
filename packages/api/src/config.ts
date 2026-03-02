import { Config, Effect } from 'effect';

const AppConfig = Config.all({
  port: Config.withDefault(Config.port('PORT'), 3001),
  corsOrigin: Config.withDefault(Config.string('CORS_ORIGIN'), 'http://localhost:3000'),
  databaseUrl: Config.string('DATABASE_URL'),
  betterAuthSecret: Config.string('BETTER_AUTH_SECRET'),
  betterAuthUrl: Config.withDefault(Config.string('BETTER_AUTH_URL'), 'http://localhost:3001'),
  githubClientId: Config.string('GITHUB_CLIENT_ID'),
  githubClientSecret: Config.string('GITHUB_CLIENT_SECRET'),
});

export const loadConfig = Effect.gen(function* () {
  return yield* AppConfig;
});
