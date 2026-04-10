import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VIGIE_HOOK_MARKER = '__vigie_managed__';

interface HookEntry {
  type: 'command';
  command: string;
  __vigie_managed__?: boolean;
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

function readSettings(claudeDir: string): ClaudeSettings {
  const path = join(claudeDir, 'settings.json');
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8')) as ClaudeSettings;
}

function writeSettings(claudeDir: string, settings: ClaudeSettings): void {
  const path = join(claudeDir, 'settings.json');
  writeFileSync(path, JSON.stringify(settings, null, 2));
}

export function installHooks(claudeDir: string, vigieUrl: string): void {
  const settings = readSettings(claudeDir);
  if (!settings.hooks) settings.hooks = {};

  const hookTypes = ['PostToolUse', 'PreToolUse', 'PostAssistantMessage'] as const;

  for (const hookType of hookTypes) {
    const entries = settings.hooks[hookType] ?? [];
    const cleaned = entries.filter((e) => !(e as HookEntry)[VIGIE_HOOK_MARKER]);
    cleaned.push({
      type: 'command',
      command: `curl -s -X POST ${vigieUrl}/api/hooks -H 'Content-Type: application/json' -d '{"type":"${hookType.toLowerCase()}","session_id":"$CLAUDE_SESSION_ID","cwd":"$CLAUDE_CWD"}'`,
      [VIGIE_HOOK_MARKER]: true,
    } as HookEntry);
    settings.hooks[hookType] = cleaned;
  }

  writeSettings(claudeDir, settings);
}

export function uninstallHooks(claudeDir: string): void {
  const settings = readSettings(claudeDir);
  if (!settings.hooks) return;

  for (const hookType of Object.keys(settings.hooks)) {
    const entries = settings.hooks[hookType];
    settings.hooks[hookType] = entries.filter((e) => !(e as HookEntry)[VIGIE_HOOK_MARKER]);
    if (settings.hooks[hookType].length === 0) {
      delete settings.hooks[hookType];
    }
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(claudeDir, settings);
}

export function getHookStatus(claudeDir: string): { installed: boolean; hookCount: number } {
  const settings = readSettings(claudeDir);
  if (!settings.hooks) return { installed: false, hookCount: 0 };

  let count = 0;
  for (const entries of Object.values(settings.hooks)) {
    count += entries.filter((e) => (e as HookEntry)[VIGIE_HOOK_MARKER]).length;
  }

  return { installed: count > 0, hookCount: count };
}
