import { Effect, Layer, ServiceMap } from 'effect';
import type { AgentRegistryShape } from '#modules/session/application/ports/out/agent-adapter.port';
import { AgentRegistry } from '#modules/session/application/ports/out/agent-adapter.port';
import type {
  PtyHandle,
  TerminalGatewayShape,
} from '#modules/session/application/ports/out/terminal-gateway.port';
import { TerminalGateway } from '#modules/session/application/ports/out/terminal-gateway.port';
import type { SessionDomainEvent } from '#shared/kernel/domain-events';
import type { AgentRunnerError } from '#shared/kernel/errors';
import type { SessionId } from '#shared/kernel/session-id';
import { SessionId as makeSessionId } from '#shared/kernel/session-id';
import { CannotResumeSessionError, SessionNotFoundError } from '../domain/errors';
import { Session } from '../domain/session';
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

interface SessionServiceDeps {
  sessionRepo: SessionRepositoryShape;
  gateway: TerminalGatewayShape;
  resumabilityChecker: ResumabilityCheckerShape;
  agentRegistry: AgentRegistryShape;
}

export function createSessionService(deps: SessionServiceDeps) {
  const { sessionRepo, gateway, resumabilityChecker, agentRegistry } = deps;

  const ptyHandles = new Map<string, PtyEntry>();
  const sessionConnections = new Map<string, string>(); // sessionId → connId
  const connSessions = new Map<string, string>(); // connId → sessionId

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => gateway.publishEvent(event), { discard: true });
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
      gateway.sendToCliClient(
        connId,
        JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
      );
    }

    Effect.runFork(gateway.publishEvent({ type: 'terminal:pty-resized', sessionId, cols, rows }));
    return { cols, rows };
  }

  function setupPtyLifecycle(sessionId: SessionId, entry: PtyEntry): void {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      gateway.appendChunk(sessionId, base64, ts);

      for (const connId of entry.cliChannels.keys()) {
        gateway.sendToCliClient(
          connId,
          JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 })
        );
      }

      gateway.broadcastOutput(sessionId, base64);
    });

    Effect.runFork(
      Effect.promise(() => entry.handle.wait()).pipe(
        Effect.flatMap((exitCode) =>
          Effect.sync(() => {
            const session = sessionRepo.findById(sessionId);
            if (!session) return;

            const adapter = agentRegistry.resolve(session.agentType);
            const resumable =
              adapter.canResume &&
              session.agentSessionId != null &&
              resumabilityChecker.isResumable(session.agentSessionId, session.cwd);

            session.markEnded(exitCode, resumable);
            sessionRepo.save(session);
            Effect.runFork(publishEvents(session.pullEvents()));

            for (const connId of entry.cliChannels.keys()) {
              gateway.sendToCliClient(
                connId,
                JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
              );
            }

            ptyHandles.delete(sessionId);
          })
        )
      )
    );
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
    }): void {
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
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    spawnInteractive(props: {
      sessionId?: string;
      agentType: string;
      cwd: string;
      cols: number;
      rows: number;
      connId?: string;
      agentSessionId?: string;
      resume?: boolean;
      gitBranch?: string;
      repoName?: string;
    }): Effect.Effect<{ sessionId: SessionId; pid: number }, AgentRunnerError> {
      return Effect.gen(function* () {
        const session = Session.create({
          id: props.sessionId,
          agentType: props.agentType,
          cwd: props.cwd,
          mode: 'interactive',
          gitBranch: props.gitBranch,
          repoName: props.repoName,
        });

        sessionRepo.save(session);

        const adapter = agentRegistry.resolve(props.agentType);
        const agentSessionId = props.agentSessionId ?? session.id;

        if (adapter.detectSessionId) {
          session.setAgentSessionId(agentSessionId);
          sessionRepo.save(session);
        }

        const { command, args } = adapter.buildSpawnArgs({
          agentSessionId,
          resume: props.resume,
        });
        const handle = yield* gateway.spawnPty(command, args, props.cwd, props.cols, props.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: props.cols, rows: props.rows },
        };
        ptyHandles.set(session.id, entry);

        if (props.connId) {
          connSessions.set(props.connId, session.id);
          entry.cliChannels.set(props.connId, { cols: props.cols, rows: props.rows });
        }

        Effect.runFork(publishEvents(session.pullEvents()));
        setupPtyLifecycle(session.id, entry);

        return { sessionId: session.id, pid: handle.pid };
      });
    },

    resume(
      sessionId: SessionId,
      opts: { cols: number; rows: number; connId?: string; gitBranch?: string; repoName?: string }
    ): Effect.Effect<
      { sessionId: SessionId; pid: number },
      SessionNotFoundError | CannotResumeSessionError | AgentRunnerError
    > {
      return Effect.gen(function* () {
        const session = sessionRepo.findById(sessionId);
        if (!session) return yield* Effect.fail(new SessionNotFoundError(sessionId));

        const adapter = agentRegistry.resolve(session.agentType);
        if (!adapter.canResume || !session.canResume) {
          return yield* Effect.fail(
            new CannotResumeSessionError(
              sessionId,
              session.agentSessionId ? 'session is not resumable' : 'no session ID'
            )
          );
        }

        session.reactivate();
        sessionRepo.save(session);

        const { command, args } = adapter.buildSpawnArgs({
          agentSessionId: session.agentSessionId,
          resume: true,
        });
        const handle = yield* gateway.spawnPty(command, args, session.cwd, opts.cols, opts.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: opts.cols, rows: opts.rows },
        };
        ptyHandles.set(sessionId, entry);

        if (opts.connId) {
          connSessions.set(opts.connId, sessionId);
          entry.cliChannels.set(opts.connId, { cols: opts.cols, rows: opts.rows });
        }

        Effect.runFork(publishEvents(session.pullEvents()));
        setupPtyLifecycle(sessionId, entry);

        return { sessionId, pid: handle.pid };
      });
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
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    deleteAllEnded(): void {
      sessionRepo.deleteAllEnded();
      Effect.runFork(gateway.publishEvent({ type: 'sessions:cleared', timestamp: Date.now() }));
    },

    markEnded(sessionId: SessionId, exitCode: number): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;

      const adapter = agentRegistry.resolve(session.agentType);
      const resumable =
        adapter.canResume &&
        session.agentSessionId != null &&
        resumabilityChecker.isResumable(session.agentSessionId, session.cwd);

      session.markEnded(exitCode, resumable);
      sessionRepo.save(session);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    markError(sessionId: SessionId, error: string): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.markError(error);
      sessionRepo.save(session);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    setAgentSessionId(sessionId: SessionId, agentSessionId: string): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.setAgentSessionId(agentSessionId);
      sessionRepo.save(session);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    deregister(sessionId: SessionId): void {
      const session = sessionRepo.findById(sessionId);
      if (session) {
        session.markEnded(0, false);
        sessionRepo.save(session);
        Effect.runFork(publishEvents(session.pullEvents()));
      }

      const connId = sessionConnections.get(sessionId);
      if (connId) {
        connSessions.delete(connId);
      }
      sessionConnections.delete(sessionId);
    },

    attach(
      sessionId: SessionId,
      connId: string,
      dims: { cols: number; rows: number }
    ): { chunks: Array<{ data: string }>; pid: number } | null {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return null;

      const cliRows = dims.rows - 1;
      entry.cliChannels.set(connId, { cols: dims.cols, rows: dims.rows });
      connSessions.set(connId, sessionId);

      entry.handle.resize(dims.cols, cliRows);
      entry.ptyDimensions = { cols: dims.cols, rows: cliRows };

      Effect.runFork(
        gateway.publishEvent({
          type: 'terminal:pty-resized',
          sessionId,
          cols: dims.cols,
          rows: cliRows,
        })
      );

      const chunks = gateway.getAllChunks(sessionId);
      return { chunks, pid: entry.handle.pid };
    },

    detach(sessionId: SessionId, connId: string): void {
      const entry = ptyHandles.get(sessionId);
      if (!entry) return;
      entry.cliChannels.delete(connId);
      connSessions.delete(connId);
      applyResizePriority(sessionId);
    },

    updateCliResize(sessionId: string, connId: string, cols: number, rows: number): void {
      const entry = ptyHandles.get(sessionId);
      if (entry?.cliChannels.has(connId)) {
        entry.cliChannels.set(connId, { cols, rows });
        applyResizePriority(sessionId);
      }
    },

    handleDisconnect(connId: string): void {
      const sessionId = connSessions.get(connId);
      if (!sessionId) return;

      const entry = ptyHandles.get(sessionId);
      if (entry) {
        entry.cliChannels.delete(connId);
        connSessions.delete(connId);
        applyResizePriority(sessionId);
      } else {
        const session = sessionRepo.findById(makeSessionId(sessionId));
        const alreadyEnded = session && (session.status === 'ended' || session.status === 'error');

        if (!alreadyEnded && session) {
          session.markEnded(-1, false);
          sessionRepo.save(session);
          Effect.runFork(publishEvents(session.pullEvents()));
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
      return gateway.getAllChunks(sessionId);
    },

    getInputHistory(sessionId: string, limit?: number) {
      return gateway.getInputHistory(sessionId, limit);
    },

    checkResumableForActive(): void {
      const activeSessions = sessionRepo.findActiveWithAgentId();
      for (const row of activeSessions) {
        const isResumable = resumabilityChecker.isResumable(row.agentSessionId, row.cwd);
        if (isResumable !== row.resumable) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(isResumable);
            sessionRepo.save(session);
            Effect.runFork(publishEvents(session.pullEvents()));
          }
        }
      }

      const recentlyEnded = sessionRepo.findRecentlyEnded(5 * 60 * 1000);
      for (const row of recentlyEnded) {
        if (resumabilityChecker.isResumable(row.agentSessionId, row.cwd)) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(true);
            sessionRepo.save(session);
            Effect.runFork(publishEvents(session.pullEvents()));
          }
        }
      }
    },

    writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void {
      const entry = ptyHandles.get(sessionId);
      if (entry) {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        entry.handle.write(bytes);
        gateway.bufferInput(sessionId, data, source, (text, src, ts) => {
          gateway.appendInput(sessionId, text, src, ts);
          Effect.runFork(
            gateway.publishEvent({
              type: 'terminal:input-echo',
              sessionId,
              text,
              source: src,
              timestamp: ts,
            })
          );
        });
      }
    },

    applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
      return applyResizePriority(sessionId);
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;

export class SessionServiceTag extends ServiceMap.Service<SessionServiceTag, SessionService>()(
  '@vigie/SessionService'
) {}

export const SessionServiceLayer = Layer.effect(SessionServiceTag)(
  Effect.gen(function* () {
    const sessionRepo = yield* SessionRepository;
    const gateway = yield* TerminalGateway;
    const resumabilityChecker = yield* ResumabilityChecker;
    const agentRegistry = yield* AgentRegistry;
    return createSessionService({ sessionRepo, gateway, resumabilityChecker, agentRegistry });
  })
);
