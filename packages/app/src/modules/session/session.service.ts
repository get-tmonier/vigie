import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Effect } from 'effect';
import type { EventPublisher } from '#modules/terminal/ports/event-publisher.port';
import type { PtyHandle, PtySpawner } from '#modules/terminal/ports/pty-spawner.port';
import type { TerminalRepository } from '#modules/terminal/ports/terminal-repository.port';
import { resolveAgent } from './domain/agent-config';
import { CannotResumeSessionError, SessionNotFoundError } from './domain/errors';
import type { SessionDomainEvent } from './domain/events';
import { Session } from './domain/session';
import type { SessionId } from './domain/session-id';
import { SessionId as makeSessionId } from './domain/session-id';
import type { SessionRepository } from './ports/session-repository.port';

interface PtyEntry {
  handle: PtyHandle;
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

interface SpawnResult {
  sessionId: SessionId;
  entry: PtyEntry;
}

interface SessionServiceDeps {
  sessionRepo: SessionRepository;
  terminalRepo: TerminalRepository;
  ptySpawner: PtySpawner;
  eventPublisher: EventPublisher;
}

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

export function createSessionService(deps: SessionServiceDeps) {
  const { sessionRepo, terminalRepo, ptySpawner, eventPublisher } = deps;

  const ptyHandles = new Map<string, PtyEntry>();
  const sessionConnections = new Map<string, string>(); // sessionId → connId
  const connSessions = new Map<string, string>(); // connId → sessionId

  function publishEvents(events: SessionDomainEvent[]): void {
    for (const event of events) {
      eventPublisher.publish(event);
    }
  }

  function setupPtyLifecycle(sessionId: SessionId, entry: PtyEntry): void {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      terminalRepo.appendChunk(sessionId, base64, ts);

      for (const connId of entry.cliChannels.keys()) {
        const msg = JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 });
        ipcSendCallback?.(connId, msg);
      }

      terminalSubscribersCallback?.(sessionId, base64);
    });

    entry.handle.wait().then((exitCode: number) => {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;

      const resumable =
        session.agentType === 'claude' &&
        session.claudeSessionId != null &&
        checkClaudeSessionResumable(session.claudeSessionId, session.cwd);

      session.markEnded(exitCode, resumable);
      sessionRepo.save(session);
      publishEvents(session.pullEvents());

      for (const connId of entry.cliChannels.keys()) {
        ipcSendCallback?.(
          connId,
          JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
        );
      }

      ptyHandles.delete(sessionId);
      console.log(`[daemon] PTY exited for session ${sessionId} (exit ${exitCode})`);
    });
  }

  // Callbacks set by daemon for IPC and terminal subscriber forwarding
  let ipcSendCallback: ((connId: string, msg: string) => void) | null = null;
  let terminalSubscribersCallback: ((sessionId: string, data: string) => void) | null = null;

  // ── Internal helpers ────────────────────────────────────────────────

  type AnsiState = 'normal' | 'escape' | 'csi';
  interface LineBuffer {
    text: string;
    state: AnsiState;
  }
  const inputLineBuffers = new Map<string, LineBuffer>();

  function inputLineBufferWrite(sessionId: string, base64Data: string, source: 'cli' | 'browser') {
    let buf = inputLineBuffers.get(sessionId);
    if (!buf) {
      buf = { text: '', state: 'normal' };
      inputLineBuffers.set(sessionId, buf);
    }
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    for (const byte of bytes) {
      switch (buf.state) {
        case 'normal': {
          if (byte === 0x1b) {
            buf.state = 'escape';
          } else if (byte === 0x0d || byte === 0x0a) {
            const line = buf.text.trim();
            if (line.length > 0) {
              const ts = Date.now();
              terminalRepo.appendInput(sessionId, line, source, ts);
              eventPublisher.publish({
                type: 'terminal:input-echo',
                sessionId,
                text: line,
                source,
                timestamp: ts,
              });
            }
            buf.text = '';
          } else if (byte === 0x7f || byte === 0x08) {
            buf.text = buf.text.slice(0, -1);
          } else if (byte >= 0x20) {
            buf.text += String.fromCharCode(byte);
          }
          break;
        }
        case 'escape': {
          buf.state =
            byte === 0x5b || byte === 0x4f || byte === 0x4e || byte === 0x5d ? 'csi' : 'normal';
          break;
        }
        case 'csi': {
          if (byte >= 0x40 && byte <= 0x7e) buf.state = 'normal';
          break;
        }
      }
    }
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
      ipcSendCallback?.(
        connId,
        JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
      );
    }

    eventPublisher.publish({ type: 'terminal:pty-resized', sessionId, cols, rows });
    return { cols, rows };
  }

  // ── Public API ──────────────────────────────────────────────────────

  return {
    ptyHandles,
    sessionConnections,
    connSessions,

    setIpcSendCallback(cb: (connId: string, msg: string) => void): void {
      ipcSendCallback = cb;
    },

    setTerminalSubscribersCallback(cb: (sessionId: string, data: string) => void): void {
      terminalSubscribersCallback = cb;
    },

    register(props: {
      sessionId: string;
      agentType: string;
      cwd: string;
      mode?: 'prompt' | 'interactive';
      gitBranch?: string;
      gitRemoteUrl?: string;
      repoName?: string;
      connId: string;
    }): Session {
      const session = Session.create({
        id: props.sessionId,
        agentType: props.agentType,
        cwd: props.cwd,
        mode: props.mode ?? 'prompt',
        gitBranch: props.gitBranch,
        gitRemoteUrl: props.gitRemoteUrl,
        repoName: props.repoName,
      });

      sessionRepo.save(session);
      sessionConnections.set(props.sessionId, props.connId);
      connSessions.set(props.connId, props.sessionId);
      publishEvents(session.pullEvents());

      console.log(
        `[daemon] Session registered: ${props.sessionId} (${props.agentType}, ${props.mode ?? 'prompt'})`
      );
      return session;
    },

    async spawnInteractive(props: {
      sessionId?: string;
      agentType: string;
      cwd: string;
      cols: number;
      rows: number;
      connId?: string;
      claudeSessionId?: string;
      resume?: boolean;
      gitBranch?: string;
      repoName?: string;
    }): Promise<SpawnResult> {
      const resolvedCwd = expandPath(props.cwd);
      const session = Session.create({
        id: props.sessionId,
        agentType: props.agentType,
        cwd: resolvedCwd,
        mode: 'interactive',
        gitBranch: props.gitBranch,
        repoName: props.repoName,
      });

      sessionRepo.save(session);

      const claudeSessionId = props.claudeSessionId ?? session.id;
      session.setClaudeSessionId(claudeSessionId);
      sessionRepo.save(session);

      const agent = resolveAgent(props.agentType);
      const handle = await Effect.runPromise(
        ptySpawner.spawn(agent, resolvedCwd, props.cols, props.rows, {
          resume: props.resume,
          claudeSessionId,
        })
      );

      const entry: PtyEntry = {
        handle,
        cliChannels: new Map(),
        browserChannels: new Map(),
        ptyDimensions: { cols: props.cols, rows: props.rows },
      };
      ptyHandles.set(session.id, entry);

      if (props.connId) {
        connSessions.set(props.connId, session.id);
      }

      publishEvents(session.pullEvents());
      setupPtyLifecycle(session.id, entry);

      console.log(
        `[daemon] PTY spawned for session ${session.id} (pid ${handle.pid}, ${props.cols}x${props.rows})`
      );
      return { sessionId: session.id, entry };
    },

    async resume(
      sessionId: SessionId,
      opts: { cols: number; rows: number; connId?: string; gitBranch?: string; repoName?: string }
    ): Promise<SpawnResult> {
      const session = sessionRepo.findById(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (!session.canResume) {
        throw new CannotResumeSessionError(
          sessionId,
          session.claudeSessionId ? 'session is not resumable' : 'no Claude session ID'
        );
      }

      session.reactivate();
      sessionRepo.save(session);

      const agent = resolveAgent('claude');
      const handle = await Effect.runPromise(
        ptySpawner.spawn(agent, session.cwd, opts.cols, opts.rows, {
          resume: true,
          claudeSessionId: session.claudeSessionId,
        })
      );

      const entry: PtyEntry = {
        handle,
        cliChannels: new Map(),
        browserChannels: new Map(),
        ptyDimensions: { cols: opts.cols, rows: opts.rows },
      };
      ptyHandles.set(sessionId, entry);

      if (opts.connId) {
        connSessions.set(opts.connId, sessionId);
      }

      publishEvents(session.pullEvents());
      setupPtyLifecycle(sessionId, entry);

      console.log(`[daemon] PTY resumed for session ${sessionId} (pid ${handle.pid})`);
      return { sessionId, entry };
    },

    kill(sessionId: SessionId): void {
      const entry = ptyHandles.get(sessionId);
      if (entry) entry.handle.kill();
    },

    delete(sessionId: SessionId): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.delete();
      sessionRepo.delete(sessionId);
      publishEvents(session.pullEvents());
    },

    deleteAllEnded(): void {
      sessionRepo.deleteAllEnded();
      eventPublisher.publish({ type: 'sessions:cleared', timestamp: Date.now() });
    },

    markEnded(sessionId: SessionId, exitCode: number): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;

      const resumable =
        session.agentType === 'claude' &&
        session.claudeSessionId != null &&
        checkClaudeSessionResumable(session.claudeSessionId, session.cwd);

      session.markEnded(exitCode, resumable);
      sessionRepo.save(session);
      publishEvents(session.pullEvents());
    },

    markError(sessionId: SessionId, error: string): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.markError(error);
      sessionRepo.save(session);
      publishEvents(session.pullEvents());
    },

    setClaudeSessionId(sessionId: SessionId, claudeSessionId: string): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.setClaudeSessionId(claudeSessionId);
      sessionRepo.save(session);
      publishEvents(session.pullEvents());
    },

    deregister(sessionId: SessionId): void {
      const session = sessionRepo.findById(sessionId);
      if (session) {
        session.markEnded(0, false);
        sessionRepo.save(session);
        publishEvents(session.pullEvents());
      }

      const connId = sessionConnections.get(sessionId);
      if (connId) {
        connSessions.delete(connId);
      }
      sessionConnections.delete(sessionId);

      console.log(`[daemon] Session deregistered: ${sessionId}`);
    },

    attach(
      sessionId: SessionId,
      connId: string,
      dims: { cols: number; rows: number }
    ): { chunks: Array<{ data: string }> } | null {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return null;

      const cliRows = dims.rows - 1;
      entry.cliChannels.set(connId, { cols: dims.cols, rows: dims.rows });
      connSessions.set(connId, sessionId);

      entry.handle.resize(dims.cols, cliRows);
      entry.ptyDimensions = { cols: dims.cols, rows: cliRows };

      eventPublisher.publish({
        type: 'terminal:pty-resized',
        sessionId,
        cols: dims.cols,
        rows: cliRows,
      });

      const chunks = terminalRepo.getAllChunks(sessionId);
      return { chunks };
    },

    detach(sessionId: SessionId, connId: string): void {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return;
      entry.cliChannels.delete(connId);
      connSessions.delete(connId);
      applyResizePriority(sessionId);
      console.log(`[daemon] CLI detached from session ${sessionId}, PTY kept alive`);
    },

    handleDisconnect(connId: string): void {
      const sessionId = connSessions.get(connId);
      if (!sessionId) return;

      const entry = ptyHandles.get(sessionId);
      if (entry) {
        entry.cliChannels.delete(connId);
        connSessions.delete(connId);
        applyResizePriority(sessionId);
        console.log(`[daemon] CLI connection lost for session ${sessionId}, PTY kept alive`);
      } else {
        const session = sessionRepo.findById(makeSessionId(sessionId));
        const alreadyEnded = session && (session.status === 'ended' || session.status === 'error');

        if (!alreadyEnded && session) {
          session.markEnded(-1, false);
          sessionRepo.save(session);
          publishEvents(session.pullEvents());
          console.log(`[daemon] Connection lost for session: ${sessionId}`);
        }

        connSessions.delete(connId);
        sessionConnections.delete(sessionId);
      }
    },

    listAll(): Session[] {
      return sessionRepo.findAll();
    },

    findById(sessionId: SessionId): Session | null {
      return sessionRepo.findById(sessionId);
    },

    getAllChunks(sessionId: string) {
      return terminalRepo.getAllChunks(sessionId);
    },

    getInputHistory(sessionId: string, limit?: number) {
      return terminalRepo.getInputHistory(sessionId, limit);
    },

    checkResumableForActive(): void {
      const activeSessions = sessionRepo.findActiveClaudeWithId();
      for (const row of activeSessions) {
        const isResumable = checkClaudeSessionResumable(row.claudeSessionId, row.cwd);
        if (isResumable !== row.resumable) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(isResumable);
            sessionRepo.save(session);
            publishEvents(session.pullEvents());
            console.log(
              `[daemon] Session ${row.id} resumable changed: ${row.resumable} -> ${isResumable}`
            );
          }
        }
      }

      const recentlyEnded = sessionRepo.findRecentlyEndedClaude(5 * 60 * 1000);
      for (const row of recentlyEnded) {
        if (checkClaudeSessionResumable(row.claudeSessionId, row.cwd)) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(true);
            sessionRepo.save(session);
            publishEvents(session.pullEvents());
            console.log(
              `[daemon] Session ${row.id} resumable updated: false -> true (post-exit check)`
            );
          }
        }
      }
    },

    writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void {
      const entry = ptyHandles.get(sessionId);
      if (entry) {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        entry.handle.write(bytes);
        inputLineBufferWrite(sessionId, data, source);
      }
    },

    applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
      return applyResizePriority(sessionId);
    },

    expandPath,
    checkClaudeSessionResumable,
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
