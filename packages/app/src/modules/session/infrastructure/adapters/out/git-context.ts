import { Effect } from 'effect';

interface GitContext {
  readonly branch?: string;
  readonly remoteUrl?: string;
  readonly repoName?: string;
}

function runGit(args: string[], cwd: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'ignore' });
      const text = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0) throw new Error(`git exited with ${exitCode}`);
      return text.trim();
    },
    catch: (err) => (err instanceof Error ? err : new Error(String(err))),
  });
}

function deriveRepoName(remoteUrl: string): string {
  return remoteUrl.replace(/\.git$/, '').replace(/^.*[/:]([\w.-]+\/[\w.-]+)$/, '$1');
}

export function getGitContext(cwd: string): Effect.Effect<GitContext> {
  return Effect.gen(function* () {
    const branch = yield* runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).pipe(
      Effect.orElseSucceed(() => undefined)
    );
    const remoteUrl = yield* runGit(['config', '--get', 'remote.origin.url'], cwd).pipe(
      Effect.orElseSucceed(() => undefined)
    );
    const repoName = remoteUrl ? deriveRepoName(remoteUrl) : undefined;
    return { branch, remoteUrl, repoName };
  });
}
