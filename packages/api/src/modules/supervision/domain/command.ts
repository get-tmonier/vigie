interface Command {
  readonly id: string;
  readonly daemonId: string;
  readonly command: string;
  readonly cwd?: string;
  readonly startedAt: number;
}

export const createCommand = (daemonId: string, command: string, cwd?: string): Command => ({
  id: crypto.randomUUID(),
  daemonId,
  command,
  cwd,
  startedAt: Date.now(),
});
