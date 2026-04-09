import { Effect } from 'effect';
import type { AgentCatalogShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import {
  CannotResumeSessionError,
  SessionNotFoundError,
} from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import type { PtyManagerShape } from '#modules/agent-session/infrastructure/pty-manager.types';
import type { AgentType } from '#shared/kernel/session/agent-type';
import type { SessionLifecycleEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

interface SpawnSessionDeps {
  sessionRepo: SessionStoreShape;
  agentCatalog: AgentCatalogShape;
  eventPublisher: SessionEventBusShape;
  ptyManager: PtyManagerShape;
}

export type SpawnSessionShape = ReturnType<typeof createSpawnSessionUseCase>;

export function createSpawnSessionUseCase(deps: SpawnSessionDeps) {
  const { sessionRepo, agentCatalog, eventPublisher, ptyManager } = deps;

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
      ptyManager.trackConnection(props.sessionId, props.connId);
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

        const adapter = agentCatalog.resolve(props.agentType);
        const agentSessionId = props.agentSessionId ?? session.id;

        if (adapter.detectSessionId) {
          session.setAgentSessionId(agentSessionId);
          sessionRepo.save(session);
        }

        const { command, args } = adapter.buildSpawnArgs({
          agentSessionId,
          resume: props.resume,
        });

        const { pid } = yield* ptyManager.spawn({
          sessionId: session.id,
          command,
          args,
          cwd: props.cwd,
          cols: props.cols,
          rows: props.rows,
          connId: props.connId,
        });

        yield* Effect.forkChild(publishEvents(session.pullEvents()));

        return { sessionId: session.id, pid };
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

        const adapter = agentCatalog.resolve(session.agentType);
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

        const { pid } = yield* ptyManager.spawn({
          sessionId,
          command,
          args,
          cwd: session.cwd,
          cols: opts.cols,
          rows: opts.rows,
          connId: opts.connId,
        });

        yield* Effect.forkChild(publishEvents(session.pullEvents()));

        return { sessionId, pid };
      });
    },
  };
}
