import { Console, Effect } from 'effect';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function printSessionSummary(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number
): Effect.Effect<void> {
  const shortId = sessionId.slice(0, 8);
  return Effect.gen(function* () {
    yield* Console.log('');
    yield* Console.log(`\u2500\u2500\u2500 Session ${shortId} complete \u2500\u2500\u2500`);
    yield* Console.log(`  Tokens: ${inputTokens} in / ${outputTokens} out`);
    yield* Console.log(`  Duration: ${formatDuration(durationMs)}`);
    yield* Console.log('');
  });
}
