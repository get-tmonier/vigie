import { Config, Effect } from 'effect';

const AppConfig = Config.all({
  port: Config.withDefault(Config.port('PORT'), 3001),
  corsOrigin: Config.withDefault(Config.string('CORS_ORIGIN'), 'http://localhost:3000'),
});

export const loadConfig = Effect.gen(function* () {
  return yield* AppConfig;
});
