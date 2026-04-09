import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentSpec } from '#modules/agent-session/application/ports/out/agent-catalog.port';

export const claudeAdapter: AgentSpec = {
  agentType: 'claude',
  canResume: true,
  detectSessionId: true,
  buildSpawnArgs(opts) {
    const args: string[] = ['claude'];
    if (opts?.agentSessionId) {
      if (opts.resume) {
        args.push('--resume', opts.agentSessionId);
      } else {
        args.push('--session-id', opts.agentSessionId);
      }
    }
    return { command: 'claude', args };
  },
  isResumable(agentSessionId: string, cwd: string): boolean {
    const projectDir = cwd.replace(/\//g, '-');
    const claudeDir = join(homedir(), '.claude', 'projects', projectDir);
    return existsSync(join(claudeDir, `${agentSessionId}.jsonl`));
  },
};
