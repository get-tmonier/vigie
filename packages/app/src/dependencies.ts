import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { makeDatabaseLayer } from '#infra/database';
// Agent-session infra layers + use case factories
import {
  AgentRegistry,
  AgentRegistryLayer,
  AppEventPublisherTag,
  BunPtySpawnerLayer,
  createCheckResumabilityUseCase,
  createPtyRegistry,
  createSessionCleanupUseCase,
  createSessionLifecycleUseCase,
  createSessionQueriesUseCase,
  createSessionRoutes,
  createSpawnSessionUseCase,
  createTerminalConnectionUseCase,
  createTerminalRoutes,
  EventPublisher,
  EventPublisherLayer,
  FsResumabilityCheckerLayer,
  PtySpawner,
  ResumabilityChecker,
  SessionRepository,
  SqliteSessionRepositoryLayer,
  SqliteTerminalRepositoryLayer,
  TerminalRepository,
  TerminalSubscribers,
  TerminalSubscribersLayer,
} from '#modules/agent-session/dependencies';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createRunDaemon } from '#modules/daemon/application/use-cases/run-daemon.use-case';
// Daemon infra layers
import { DaemonConfigLayer, UnixSocketServerLayer } from '#modules/daemon/dependencies';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

function cleanup() {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try {
      unlinkSync(join(_HOME, file));
    } catch {}
  }
}

const DatabaseLayer = makeDatabaseLayer(`${_HOME}/data.db`);

const BaseInfraLayer = Layer.mergeAll(
  EventPublisherLayer,
  BunPtySpawnerLayer,
  FsResumabilityCheckerLayer,
  AgentRegistryLayer,
  TerminalSubscribersLayer,
  UnixSocketServerLayer,
  DaemonConfigLayer
);

const InfraLayer = Layer.mergeAll(SqliteSessionRepositoryLayer, SqliteTerminalRepositoryLayer).pipe(
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(BaseInfraLayer)
);

const runDaemonEffect = Effect.gen(function* () {
  const sessionRepo = yield* SessionRepository;
  const terminalRepo = yield* TerminalRepository;
  const ptySpawner = yield* PtySpawner;
  const agentRegistry = yield* AgentRegistry;
  const resumabilityChecker = yield* ResumabilityChecker;
  const eventPublisher = yield* EventPublisher;
  const terminalSubs = yield* TerminalSubscribers;
  const ipcServer = yield* IpcServer;
  const appEventPublisher = yield* AppEventPublisherTag;

  const registry = createPtyRegistry();

  // Create a sendToCliClient that captures ipcServer via closure
  // The ipcServer.sendTo returns Effect<void>, so we need to run it synchronously
  const sendToCliClientFn = (connId: string, msg: string): void => {
    Effect.runFork(ipcServer.sendTo(connId, msg));
  };

  const terminalConnection = createTerminalConnectionUseCase({
    sessionRepo,
    terminalRepo,
    eventPublisher,
    terminalSubs,
    agentRegistry,
    resumabilityChecker,
    registry,
    sendToCliClient: sendToCliClientFn,
  });

  const spawnSession = createSpawnSessionUseCase({
    sessionRepo,
    ptySpawner,
    agentRegistry,
    eventPublisher,
    registry,
    setupPtyLifecycle: terminalConnection.setupPtyLifecycle,
  });

  const sessionLifecycle = createSessionLifecycleUseCase({
    sessionRepo,
    resumabilityChecker,
    agentRegistry,
    eventPublisher,
    registry,
  });

  const sessionCleanup = createSessionCleanupUseCase({
    sessionRepo,
    eventPublisher,
  });

  const checkResumability = createCheckResumabilityUseCase({
    sessionRepo,
    resumabilityChecker,
    eventPublisher,
  });

  const sessionQueries = createSessionQueriesUseCase({
    sessionRepo,
    terminalRepo,
  });

  const startupOps = {
    cleanupOrphanedSessions: () => sessionRepo.markOrphanedEnded(),
    pruneOldSessions: () => sessionRepo.pruneOld(),
    checkResumableForAll: () => {
      sessionRepo.findAll().forEach((session) => {
        if (session.agentSessionId) {
          const resumable = resumabilityChecker.isResumable(session.agentSessionId, session.cwd);
          if (resumable !== session.resumable) {
            session.setResumable(resumable);
            sessionRepo.save(session);
            session.pullEvents();
          }
        }
      });
    },
    checkResumableForActive: () => checkResumability.checkResumableForActive(),
  };

  const appRoutes = createRoutesLayer({
    appRoutes: [
      ...createSessionRoutes({
        spawnSession,
        sessionCleanup,
        sessionQueries,
        terminalConnection,
        eventPublisher: appEventPublisher,
      }),
      ...createTerminalRoutes({
        sessionQueries,
        terminalConnection,
        terminalSubs,
      }),
    ],
    clientDistPath: undefined,
  });

  const runner = createRunDaemon({
    startupOps,
    spawnSession,
    sessionLifecycle,
    terminalConnection,
    appRoutes,
    cleanup,
  });

  yield* runner;
}).pipe(Effect.scoped) as Effect.Effect<never, never, never>;

export const AppLayer = InfraLayer;
export const runDaemon = runDaemonEffect;
