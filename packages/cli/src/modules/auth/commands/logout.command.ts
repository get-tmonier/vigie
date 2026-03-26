import { Console, Effect } from 'effect';
import { clearCredentials } from '../credentials.js';

export function logoutCommand(): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* Effect.promise(() => clearCredentials());
    yield* Console.log('Credentials cleared.');
  });
}
