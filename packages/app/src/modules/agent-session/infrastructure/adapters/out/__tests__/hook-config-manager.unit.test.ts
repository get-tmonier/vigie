import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getHookStatus, installHooks, uninstallHooks } from '../hook-config-manager';

describe('hookConfigManager', () => {
  it('installs vigie hooks into Claude Code settings', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vigie-test-'));
    writeFileSync(join(tempDir, 'settings.json'), '{}');

    installHooks(tempDir, 'http://localhost:19191');

    const settings = JSON.parse(readFileSync(join(tempDir, 'settings.json'), 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PostToolUse).toBeDefined();
  });

  it('uninstalls vigie hooks', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vigie-test-'));
    writeFileSync(join(tempDir, 'settings.json'), '{}');

    installHooks(tempDir, 'http://localhost:19191');
    uninstallHooks(tempDir);

    const settings = JSON.parse(readFileSync(join(tempDir, 'settings.json'), 'utf-8'));
    expect(settings.hooks?.PostToolUse).toBeUndefined();
  });

  it('reports installed status correctly', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'vigie-test-'));
    writeFileSync(join(tempDir, 'settings.json'), '{}');

    expect(getHookStatus(tempDir).installed).toBe(false);
    installHooks(tempDir, 'http://localhost:19191');
    expect(getHookStatus(tempDir).installed).toBe(true);
  });
});
