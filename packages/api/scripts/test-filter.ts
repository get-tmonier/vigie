import { Effect } from 'effect';
import { Glob } from 'bun';

const suffix = process.argv[2]; // e.g. "unit" or "integration"
if (!suffix) {
  await Effect.runPromise(Effect.logError('Usage: bun scripts/test-filter.ts <unit|integration>'));
  process.exit(1);
}

const files = await Array.fromAsync(new Glob(`**/*.${suffix}.test.ts`).scan({ cwd: 'src' }));

if (files.length === 0) {
  await Effect.runPromise(Effect.logInfo(`No ${suffix} test files found.`));
  process.exit(0);
}

const proc = Bun.spawn(['bun', 'test', ...files.map((f) => `src/${f}`)], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});

process.exit(await proc.exited);
