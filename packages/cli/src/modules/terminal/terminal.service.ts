import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Effect } from 'effect';
import type { LineBuffer } from '../daemon/input-line-buffer.js';
import { stripAnsiAndBuffer } from '../daemon/input-line-buffer.js';
import type { createSessionStore } from '../daemon/persistence/session-store.js';
import type { InteractiveRunnerHandle } from '../session/adapters/agents/agent-interactive-runner.adapter.js';
import { spawnAgentInteractive } from '../session/adapters/agents/agent-interactive-runner.adapter.js';
import { resolveAgent } from '../session/domain/agent-config.js';
import type { AgentSession } from '../session/domain/session.js';
import type { EventBus } from './event-bus.js';
import type { TerminalSubscribers } from './terminal-subscribers.js';

export interface PtyEntry {
  handle: InteractiveRunnerHandle;
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

type SpawnOpts = {
  sessionId?: string;
  agentType: string;
  cwd: string;
  cols: number;
  rows: number;
  claudeSessionId?: string;
  resume?: boolean;
};

type SpawnResult = {
  sessionId: string;
  handle: InteractiveRunnerHandle;
  entry: PtyEntry;
};

type TerminalServiceDeps = {
  store: ReturnType<typeof createSessionStore>;
  eventBus: EventBus;
  terminalSubs: TerminalSubscribers;
  ipcSendTo: (connId: string, msg: string) => Effect.Effect<void>;
  onSessionCreated: (session: AgentSession) => void;
  onSessionStatusChange: (sessionId: string, status: AgentSession['status']) => void;
};

export function createTerminalService(deps: TerminalServiceDeps) {
  const { store, eventBus, terminalSubs, ipcSendTo, onSessionCreated, onSessionStatusChange } =
    deps;

  const ptyHandles = new Map<string, PtyEntry>();
  const inputLineBuffers = new Map<string, LineBuffer>();

  function expandPath(p: string): string {
    if (p === '~' || p.startsWith('~/')) {
      return resolve(homedir(), p.slice(2) || '.');
    }
    return resolve(p);
  }

  function checkClaudeSessionResumable(claudeSessionId: string, cwd: string): boolean {
    const projectDir = cwd.replace(/\//g, '-');
    const claudeDir = join(homedir(), '.claude', 'projects', projectDir);
    return existsSync(join(claudeDir, `${claudeSessionId}.jsonl`));
  }

  function applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
    const entry = ptyHandles.get(sessionId);
    if (!entry) return null;

    let cols: number;
    let rows: number;
    if (entry.browserChannels.size > 0) {
      const first = entry.browserChannels.values().next().value;
      if (!first) return null;
      cols = first.cols;
      rows = first.rows;
    } else if (entry.cliChannels.size > 0) {
      const first = entry.cliChannels.values().next().value;
      if (!first) return null;
      cols = first.cols;
      rows = first.rows - 1;
    } else {
      return null;
    }

    entry.handle.resize(cols, rows);
    entry.ptyDimensions = { cols, rows };

    for (const connId of entry.cliChannels.keys()) {
      Effect.runSync(
        ipcSendTo(
          connId,
          JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
        )
      );
    }

    eventBus.publish({ type: 'terminal:pty-resized', sessionId, cols, rows });
    return { cols, rows };
  }

  function inputLineBufferWrite(sessionId: string, base64Data: string, source: 'cli' | 'browser') {
    stripAnsiAndBuffer(inputLineBuffers, sessionId, base64Data, source, (text, src, timestamp) => {
      store.appendInputEntry(sessionId, text, src, timestamp);
      eventBus.publish({ type: 'terminal:input-echo', sessionId, text, source: src, timestamp });
    });
  }

  function setupPtyLifecycle(sessionId: string, entry: PtyEntry) {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      store.appendTerminalChunk(sessionId, base64, ts);

      for (const connId of entry.cliChannels.keys()) {
        Effect.runSync(
          ipcSendTo(connId, JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 }))
        );
      }

      terminalSubs.publish(sessionId, base64);
    });

    entry.handle.wait().then((exitCode: number) => {
      const sessionRow = store.getSessionById(sessionId);
      const resumable =
        sessionRow?.agent_type === 'claude' &&
        sessionRow.claude_session_id != null &&
        checkClaudeSessionResumable(sessionRow.claude_session_id, sessionRow.cwd);
      store.markSessionEnded(sessionId, 'ended', exitCode, resumable);

      for (const connId of entry.cliChannels.keys()) {
        Effect.runSync(
          ipcSendTo(connId, JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode }))
        );
      }

      eventBus.publish({
        type: 'session:ended',
        sessionId,
        exitCode,
        resumable,
        timestamp: Date.now(),
      });

      onSessionStatusChange(sessionId, 'ended');
      ptyHandles.delete(sessionId);
      console.log(`[daemon] PTY exited for session ${sessionId} (exit ${exitCode})`);
    });
  }

  async function doSpawnSession(opts: SpawnOpts): Promise<SpawnResult> {
    const sessionId = opts.sessionId ?? crypto.randomUUID();
    const resolvedCwd = expandPath(opts.cwd);

    const session: AgentSession = {
      id: sessionId,
      agentType: opts.agentType as AgentSession['agentType'],
      cwd: resolvedCwd,
      startedAt: Date.now(),
      status: 'active',
    };

    onSessionCreated(session);
    store.upsertSession(session, 'interactive');
    store.updateClaudeSessionId(sessionId, opts.claudeSessionId ?? sessionId);

    if (opts.resume) {
      store.reactivateSession(sessionId);
    }

    const agent = resolveAgent(opts.agentType);
    const handle = await Effect.runPromise(
      spawnAgentInteractive(agent, resolvedCwd, opts.cols, opts.rows, {
        resume: opts.resume,
        claudeSessionId: opts.claudeSessionId ?? sessionId,
      })
    );

    const entry: PtyEntry = {
      handle,
      cliChannels: new Map(),
      browserChannels: new Map(),
      ptyDimensions: { cols: opts.cols, rows: opts.rows },
    };
    ptyHandles.set(sessionId, entry);

    return { sessionId, handle, entry };
  }

  function writeInput(sessionId: string, data: string, source: 'cli' | 'browser') {
    const entry = ptyHandles.get(sessionId);
    if (entry) {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      entry.handle.write(bytes);
      inputLineBufferWrite(sessionId, data, source);
    }
  }

  return {
    ptyHandles,
    expandPath,
    checkClaudeSessionResumable,
    applyResizePriority,
    inputLineBufferWrite,
    setupPtyLifecycle,
    doSpawnSession,
    writeInput,
  };
}
