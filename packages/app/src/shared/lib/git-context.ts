import { Data, Effect } from 'effect';

class GitError extends Data.TaggedError('GitError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

interface GitContext {
  readonly branch?: string;
  readonly remoteUrl?: string;
  readonly repoName?: string;
}

function runGit(args: string[], cwd: string): Effect.Effect<string, GitError> {
  return Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'ignore' });
      const text = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      return { text: text.trim(), exitCode };
    },
    catch: (cause) => new GitError({ message: String(cause), cause }),
  }).pipe(
    Effect.flatMap(({ text, exitCode }) =>
      exitCode !== 0
        ? Effect.fail(new GitError({ message: `git exited with ${exitCode}` }))
        : Effect.succeed(text)
    )
  );
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
