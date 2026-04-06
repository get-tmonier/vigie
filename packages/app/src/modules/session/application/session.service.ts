import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Effect, Layer, ServiceMap } from 'effect';
import type { IpcServerShape } from '#modules/daemon/application/ports/out/ipc-server.port';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import type { AgentRegistryShape } from '#modules/session/application/ports/out/agent-adapter.port';
import { AgentRegistry } from '#modules/session/application/ports/out/agent-adapter.port';
import type { EventPublisherShape } from '#modules/terminal/application/ports/out/event-publisher.port';
import { EventPublisher } from '#modules/terminal/application/ports/out/event-publisher.port';
import type {
  PtyHandle,
  PtySpawnerShape,
} from '#modules/terminal/application/ports/out/pty-spawner.port';
import { PtySpawner } from '#modules/terminal/application/ports/out/pty-spawner.port';
import type { TerminalRepositoryShape } from '#modules/terminal/application/ports/out/terminal-repository.port';
import { TerminalRepository } from '#modules/terminal/application/ports/out/terminal-repository.port';
import type { TerminalSubscribersShape } from '#modules/terminal/application/terminal-subscribers';
import { TerminalSubscribers } from '#modules/terminal/application/terminal-subscribers';
import type { LineBuffer } from '#modules/terminal/domain/input-line-buffer';
import { stripAnsiAndBuffer } from '#modules/terminal/domain/input-line-buffer';
import { CannotResumeSessionError, SessionNotFoundError } from '../domain/errors';
import type { SessionDomainEvent } from '../domain/events';
import { Session } from '../domain/session';
import type { SessionId } from '../domain/session-id';
import { SessionId as makeSessionId } from '../domain/session-id';
import type { ResumabilityCheckerShape } from './ports/out/resumability-checker.port';
import { ResumabilityChecker } from './ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from './ports/out/session-repository.port';
import { SessionRepository } from './ports/out/session-repository.port';

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
  sessionRepo: SessionRepositoryShape;
  terminalRepo: TerminalRepositoryShape;
  ptySpawner: PtySpawnerShape;
  eventPublisher: EventPublisherShape;
  resumabilityChecker: ResumabilityCheckerShape;
  agentRegistry: AgentRegistryShape;
  ipcServer: IpcServerShape;
  terminalSubs: TerminalSubscribersShape;
}

function expandPath(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return resolve(homedir(), p.slice(2) || '.');
  }
  return resolve(p);
}

export function createSessionService(deps: SessionServiceDeps) {
  const {
    sessionRepo,
    terminalRepo,
    ptySpawner,
    eventPublisher,
    resumabilityChecker,
    agentRegistry,
    ipcServer,
    terminalSubs,
  } = deps;

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
        Effect.runSync(ipcServer.sendTo(connId, msg));
      }

      terminalSubs.publish(sessionId, base64);
    });

    entry.handle.wait().then((exitCode: number) => {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;

      const adapter = agentRegistry.resolve(session.agentType);
      const resumable =
        adapter.canResume &&
        session.claudeSessionId != null &&
        resumabilityChecker.isResumable(session.claudeSessionId, session.cwd);

      session.markEnded(exitCode, resumable);
      sessionRepo.save(session);
      publishEvents(session.pullEvents());

      for (const connId of entry.cliChannels.keys()) {
        Effect.runSync(
          ipcServer.sendTo(
            connId,
            JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
          )
        );
      }

      ptyHandles.delete(sessionId);
      console.log(`[daemon] PTY exited for session ${sessionId} (exit ${exitCode})`);
    });
  }

  // ── Internal helpers ────────────────────────────────────────────────

  const inputLineBuffers = new Map<string, LineBuffer>();

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
        ipcServer.sendTo(
          connId,
          JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
        )
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

      const adapter = agentRegistry.resolve(props.agentType);
      const claudeSessionId = props.claudeSessionId ?? session.id;

      if (adapter.detectSessionId) {
        session.setClaudeSessionId(claudeSessionId);
        sessionRepo.save(session);
      }

      const { command, args } = adapter.buildSpawnArgs({
        claudeSessionId,
        resume: props.resume,
      });
      const handle = await Effect.runPromise(
        ptySpawner.spawn(command, args, resolvedCwd, props.cols, props.rows)
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

      const adapter = agentRegistry.resolve(session.agentType);
      if (!adapter.canResume || !session.canResume) {
        throw new CannotResumeSessionError(
          sessionId,
          session.claudeSessionId ? 'session is not resumable' : 'no session ID'
        );
      }

      session.reactivate();
      sessionRepo.save(session);

      const { command, args } = adapter.buildSpawnArgs({
        claudeSessionId: session.claudeSessionId,
        resume: true,
      });
      const handle = await Effect.runPromise(
        ptySpawner.spawn(command, args, session.cwd, opts.cols, opts.rows)
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

      const adapter = agentRegistry.resolve(session.agentType);
      const resumable =
        adapter.canResume &&
        session.claudeSessionId != null &&
        resumabilityChecker.isResumable(session.claudeSessionId, session.cwd);

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
        const isResumable = resumabilityChecker.isResumable(row.claudeSessionId, row.cwd);
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
        if (resumabilityChecker.isResumable(row.claudeSessionId, row.cwd)) {
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
        stripAnsiAndBuffer(inputLineBuffers, sessionId, data, source, (text, src, ts) => {
          terminalRepo.appendInput(sessionId, text, src, ts);
          eventPublisher.publish({
            type: 'terminal:input-echo',
            sessionId,
            text,
            source: src,
            timestamp: ts,
          });
        });
      }
    },

    applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
      return applyResizePriority(sessionId);
    },

    expandPath,
  };
}

export type SessionService = ReturnType<typeof createSessionService>;

export class SessionServiceTag extends ServiceMap.Service<SessionServiceTag, SessionService>()(
  '@vigie/SessionService'
) {}

export const SessionServiceLayer = Layer.effect(SessionServiceTag)(
  Effect.gen(function* () {
    const sessionRepo = yield* SessionRepository;
    const terminalRepo = yield* TerminalRepository;
    const ptySpawner = yield* PtySpawner;
    const eventPublisher = yield* EventPublisher;
    const resumabilityChecker = yield* ResumabilityChecker;
    const agentRegistry = yield* AgentRegistry;
    const ipcServer = yield* IpcServer;
    const terminalSubs = yield* TerminalSubscribers;
    return createSessionService({
      sessionRepo,
      terminalRepo,
      ptySpawner,
      eventPublisher,
      resumabilityChecker,
      agentRegistry,
      ipcServer,
      terminalSubs,
    });
  })
);
