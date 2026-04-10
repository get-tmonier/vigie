import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import {
  getHookStatus,
  installHooks,
  uninstallHooks,
} from '#modules/agent-session/infrastructure/adapters/out/hook-config-manager';

const CLAUDE_DIR = join(homedir(), '.claude');
const VIGIE_URL = 'http://localhost:19191';

export function hooksStatusCommand(): Effect.Effect<void> {
  return Effect.sync(() => {
    const status = getHookStatus(CLAUDE_DIR);
    if (status.installed) {
      process.stdout.write(`vigie hooks: installed (${status.hookCount} hooks)\n`);
    } else {
      process.stdout.write('vigie hooks: not installed\n');
    }
  });
}

export function hooksInstallCommand(): Effect.Effect<void> {
  return Effect.sync(() => {
    installHooks(CLAUDE_DIR, VIGIE_URL);
    process.stdout.write('vigie hooks installed into Claude Code settings\n');
  });
}

export function hooksUninstallCommand(): Effect.Effect<void> {
  return Effect.sync(() => {
    uninstallHooks(CLAUDE_DIR);
    process.stdout.write('vigie hooks removed from Claude Code settings\n');
  });
}
