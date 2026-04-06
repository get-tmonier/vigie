import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Layer } from 'effect';
import {
  ResumabilityChecker,
  type ResumabilityCheckerShape,
} from '#modules/session/application/ports/out/resumability-checker.port';

function createFsResumabilityChecker(): ResumabilityCheckerShape {
  return {
    isResumable(agentSessionId: string, cwd: string): boolean {
      const projectDir = cwd.replace(/\//g, '-');
      const claudeDir = join(homedir(), '.claude', 'projects', projectDir);
      return existsSync(join(claudeDir, `${agentSessionId}.jsonl`));
    },
  };
}

export const FsResumabilityCheckerLayer = Layer.sync(ResumabilityChecker)(() =>
  createFsResumabilityChecker()
);
