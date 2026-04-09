import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { PtySpawnerShape } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import {
  CannotResumeSessionError,
  SessionNotFoundError,
} from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import type { PtyEntry, PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
import type { AgentType } from '#shared/kernel/session/agent-type';
import type { SessionLifecycleEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

interface SpawnSessionDeps {
  sessionRepo: SessionRepositoryShape;
  ptySpawner: PtySpawnerShape;
  agentRegistry: AgentRegistryShape;
  eventPublisher: DomainEventBusShape;
  registry: PtyRegistry;
  setupPtyLifecycle: (sessionId: SessionId, entry: PtyEntry) => void;
}

export type SpawnSessionShape = ReturnType<typeof createSpawnSessionUseCase>;

export function createSpawnSessionUseCase(deps: SpawnSessionDeps) {
  const { sessionRepo, ptySpawner, agentRegistry, eventPublisher, registry, setupPtyLifecycle } =
    deps;

  function publishEvents(events: SessionLifecycleEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) =>
        Effect.logWarning('Event publish failed (non-fatal)', cause)
      )
    );
  }

  return {
    register(props: {
      sessionId: SessionId;
      agentType: AgentType;
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
      registry.sessionConnections.set(props.sessionId, props.connId);
      registry.connSessions.set(props.connId, props.sessionId);
      fireAndForget(publishEvents(session.pullEvents()));
    },

    spawnInteractive(props: {
      sessionId?: SessionId;
      agentType: AgentType;
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
        const handle = yield* ptySpawner.spawn(command, args, props.cwd, props.cols, props.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: props.cols, rows: props.rows },
        };
        registry.ptyHandles.set(session.id, entry);

        if (props.connId) {
          registry.connSessions.set(props.connId, session.id);
          entry.cliChannels.set(props.connId, { cols: props.cols, rows: props.rows });
        }

        yield* Effect.forkChild(publishEvents(session.pullEvents()));
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
        if (!session) return yield* new SessionNotFoundError(sessionId);

        const adapter = agentRegistry.resolve(session.agentType);
        if (!adapter.canResume || !session.canResume) {
          return yield* new CannotResumeSessionError(
            sessionId,
            session.agentSessionId ? 'session is not resumable' : 'no session ID'
          );
        }

        session.reactivate();
        sessionRepo.save(session);

        const { command, args } = adapter.buildSpawnArgs({
          agentSessionId: session.agentSessionId,
          resume: true,
        });
        const handle = yield* ptySpawner.spawn(command, args, session.cwd, opts.cols, opts.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: opts.cols, rows: opts.rows },
        };
        registry.ptyHandles.set(sessionId, entry);

        if (opts.connId) {
          registry.connSessions.set(opts.connId, sessionId);
          entry.cliChannels.set(opts.connId, { cols: opts.cols, rows: opts.rows });
        }

        yield* Effect.forkChild(publishEvents(session.pullEvents()));
        setupPtyLifecycle(sessionId, entry);

        return { sessionId, pid: handle.pid };
      });
    },
  };
}
