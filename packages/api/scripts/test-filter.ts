import { Glob } from 'bun';

const suffix = process.argv[2]; // e.g. "unit" or "integration"
if (!suffix) {
  console.error('Usage: bun scripts/test-filter.ts <unit|integration>');
  process.exit(1);
}

const files = await Array.fromAsync(
  new Glob(`**/*.${suffix}.test.ts`).scan({ cwd: 'src' })
);

if (files.length === 0) {
  console.log(`No ${suffix} test files found.`);
  process.exit(0);
}

const proc = Bun.spawn(['bun', 'test', ...files.map((f) => `src/${f}`)], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});

process.exit(await proc.exited);
