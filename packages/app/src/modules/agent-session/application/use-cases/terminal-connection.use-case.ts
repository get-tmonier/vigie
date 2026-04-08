import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { TerminalRepositoryShape } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { TerminalSubscribersShape } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import type { PtyEntry, PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
import { type LineBuffer, stripAnsiAndBuffer } from '#shared/lib/input-line-buffer';

interface TerminalConnectionDeps {
  sessionRepo: SessionRepositoryShape;
  terminalRepo: TerminalRepositoryShape;
  eventPublisher: DomainEventBusShape;
  terminalSubs: TerminalSubscribersShape;
  agentRegistry: AgentRegistryShape;
  resumabilityChecker: ResumabilityCheckerShape;
  registry: PtyRegistry;
  sendToCliClient: (connId: string, msg: string) => void;
}

export type TerminalConnectionShape = ReturnType<typeof createTerminalConnectionUseCase>;

export function createTerminalConnectionUseCase(deps: TerminalConnectionDeps) {
  const {
    sessionRepo,
    terminalRepo,
    eventPublisher,
    terminalSubs,
    agentRegistry,
    resumabilityChecker,
    registry,
    sendToCliClient,
  } = deps;

  const inputLineBuffers = new Map<string, LineBuffer>();

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) =>
        Effect.logWarning('Event publish failed (non-fatal)', cause)
      )
    );
  }

  function applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
    const entry = registry.ptyHandles.get(sessionId);
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
      sendToCliClient(
        connId,
        JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
      );
    }

    fireAndForget(eventPublisher.publish({ type: 'terminal:pty-resized', sessionId, cols, rows }));
    return { cols, rows };
  }

  function setupPtyLifecycle(sessionId: SessionId, entry: PtyEntry): void {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      terminalRepo.appendChunk(sessionId, base64, ts);

      for (const connId of entry.cliChannels.keys()) {
        sendToCliClient(
          connId,
          JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 })
        );
      }

      fireAndForget(terminalSubs.publish(sessionId, base64));
    });

    fireAndForget(
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
            fireAndForget(publishEvents(session.pullEvents()));

            for (const connId of entry.cliChannels.keys()) {
              sendToCliClient(
                connId,
                JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
              );
            }

            registry.ptyHandles.delete(sessionId);
          })
        )
      )
    );
  }

  return {
    setupPtyLifecycle,

    kill(sessionId: string): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (entry) entry.handle.kill();
    },

    killAll(): void {
      for (const entry of registry.ptyHandles.values()) {
        entry.handle.kill();
      }
    },

    getActivePid(sessionId: string): number | null {
      return registry.ptyHandles.get(sessionId)?.handle.pid ?? null;
    },

    attach(
      sessionId: string,
      connId: string,
      dims: { cols: number; rows: number }
    ): { chunks: Array<{ data: string }>; pid: number } | null {
      const id = makeSessionId(sessionId);
      const entry = registry.ptyHandles.get(id);
      if (!entry) return null;

      const cliRows = dims.rows - 1;
      entry.cliChannels.set(connId, { cols: dims.cols, rows: dims.rows });
      registry.connSessions.set(connId, id);

      entry.handle.resize(dims.cols, cliRows);
      entry.ptyDimensions = { cols: dims.cols, rows: cliRows };

      fireAndForget(
        eventPublisher.publish({
          type: 'terminal:pty-resized',
          sessionId,
          cols: dims.cols,
          rows: cliRows,
        })
      );

      const chunks = terminalRepo.getAllChunks(sessionId);
      return { chunks, pid: entry.handle.pid };
    },

    detach(sessionId: string, connId: string): void {
      const id = makeSessionId(sessionId);
      const entry = registry.ptyHandles.get(id);
      if (!entry) return;
      entry.cliChannels.delete(connId);
      registry.connSessions.delete(connId);
      applyResizePriority(id);
    },

    updateCliResize(sessionId: string, connId: string, cols: number, rows: number): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (entry?.cliChannels.has(connId)) {
        entry.cliChannels.set(connId, { cols, rows });
        applyResizePriority(sessionId);
      }
    },

    handleDisconnect(connId: string): void {
      const sessionId = registry.connSessions.get(connId);
      if (!sessionId) return;

      const entry = registry.ptyHandles.get(sessionId);
      if (entry) {
        entry.cliChannels.delete(connId);
        registry.connSessions.delete(connId);
        applyResizePriority(sessionId);
      } else {
        const id = makeSessionId(sessionId);
        const session = sessionRepo.findById(id);
        const alreadyEnded = session && (session.status === 'ended' || session.status === 'error');

        if (!alreadyEnded && session) {
          session.markEnded(-1, false);
          sessionRepo.save(session);
          fireAndForget(publishEvents(session.pullEvents()));
        }

        registry.connSessions.delete(connId);
        registry.sessionConnections.delete(sessionId);
      }
    },

    writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return;

      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      entry.handle.write(bytes);

      stripAnsiAndBuffer(inputLineBuffers, sessionId, data, source, (text, src, ts) => {
        terminalRepo.appendInput(sessionId, text, src, ts);
        fireAndForget(
          eventPublisher.publish({
            type: 'terminal:input-echo',
            sessionId,
            text,
            source: src,
            timestamp: ts,
          })
        );
      });
    },

    applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
      return applyResizePriority(sessionId);
    },

    addBrowserChannel(
      sessionId: string,
      connId: string,
      dims: { cols: number; rows: number }
    ): number | null {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return null;
      entry.browserChannels.set(connId, dims);
      applyResizePriority(sessionId);
      return entry.handle.pid;
    },

    updateBrowserChannel(
      sessionId: string,
      connId: string,
      dims: { cols: number; rows: number }
    ): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return;
      entry.browserChannels.set(connId, dims);
      applyResizePriority(sessionId);
    },

    removeBrowserChannel(sessionId: string, connId: string): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return;
      entry.browserChannels.delete(connId);
      applyResizePriority(sessionId);
    },

    writeBinaryInput(sessionId: string, data: Uint8Array): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (entry) {
        entry.handle.write(data);
        const base64 = Buffer.from(data).toString('base64');
        this.writeInput(sessionId, base64, 'browser');
      }
    },
  };
}
