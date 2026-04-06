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
) {
  const shortId = sessionId.slice(0, 8);
  console.log();
  console.log(`\u2500\u2500\u2500 Session ${shortId} complete \u2500\u2500\u2500`);
  console.log(`  Tokens: ${inputTokens} in / ${outputTokens} out`);
  console.log(`  Duration: ${formatDuration(durationMs)}`);
  console.log();
}
