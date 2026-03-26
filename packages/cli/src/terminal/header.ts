interface HeaderOptions {
  readonly sessionId: string;
  readonly daemonPid: number;
  readonly cwd: string;
  readonly repoName?: string;
  readonly gitBranch?: string;
  readonly mode?: 'prompt' | 'interactive';
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : `${str}${' '.repeat(len - str.length)}`;
}

export function printHeader(opts: HeaderOptions) {
  const shortId = opts.sessionId.slice(0, 8);
  const cwdShort = opts.cwd.replace(process.env.HOME ?? '', '~');
  const repoInfo = opts.repoName
    ? `${opts.repoName}${opts.gitBranch ? ` (${opts.gitBranch})` : ''}`
    : (opts.gitBranch ?? 'n/a');

  const width = 43;
  const sep = '\u2500'.repeat(width);

  const modeLabel = opts.mode === 'interactive' ? 'Interactive Session' : 'Claude Code Session';

  console.log(`\u250c${sep}\u2510`);
  console.log(`\u2502  ${pad(`TMONIER \u00b7 ${modeLabel}`, width - 2)}\u2502`);
  console.log(`\u251c${sep}\u2524`);
  console.log(`\u2502  ${pad(`Session   ${shortId}`, width - 2)}\u2502`);
  console.log(
    `\u2502  ${pad(`Daemon    \u25cf connected (pid ${opts.daemonPid})`, width - 2)}\u2502`
  );
  console.log(`\u2502  ${pad(`Repo      ${repoInfo}`, width - 2)}\u2502`);
  console.log(`\u2502  ${pad(`CWD       ${cwdShort}`, width - 2)}\u2502`);
  console.log(`\u2514${sep}\u2518`);
  console.log();
}
