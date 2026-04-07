import { Effect } from 'effect';
import { type LineBuffer, stripAnsiAndBuffer } from '#lib/input-line-buffer';
import type { EventPublisherShape } from '#modules/terminal/application/ports/out/event-publisher.port';
import type { PtySpawnerShape } from '#modules/terminal/application/ports/out/pty-spawner.port';
import type { TerminalRepositoryShape } from '#modules/terminal/application/ports/out/terminal-repository.port';
import type { TerminalSubscribersShape } from '#modules/terminal/application/terminal-subscribers';
import type { DomainEvent } from '#shared/kernel/domain-events';
import type { AgentRunnerError } from '#shared/kernel/errors';
import type { PtyHandle } from '#shared/kernel/pty';
import type { TerminalGatewayShape } from '#shared/kernel/terminal-gateway';

export function createTerminalGateway(deps: {
  ptySpawner: PtySpawnerShape;
  terminalRepo: TerminalRepositoryShape;
  eventPublisher: EventPublisherShape;
  terminalSubs: TerminalSubscribersShape;
  sendToCliClient: (connId: string, msg: string) => void;
}): TerminalGatewayShape {
  const { ptySpawner, terminalRepo, eventPublisher, terminalSubs, sendToCliClient } = deps;
  const inputLineBuffers = new Map<string, LineBuffer>();

  return {
    spawnPty(
      command: string,
      args: string[],
      cwd: string,
      cols: number,
      rows: number
    ): Effect.Effect<PtyHandle, AgentRunnerError> {
      return ptySpawner.spawn(command, args, cwd, cols, rows);
    },

    appendChunk(sessionId: string, base64: string, ts: number): void {
      terminalRepo.appendChunk(sessionId, base64, ts);
    },

    getAllChunks(sessionId: string) {
      return terminalRepo.getAllChunks(sessionId);
    },

    appendInput(sessionId: string, text: string, source: 'cli' | 'browser', ts: number): void {
      terminalRepo.appendInput(sessionId, text, source, ts);
    },

    getInputHistory(sessionId: string, limit?: number) {
      return terminalRepo.getInputHistory(sessionId, limit);
    },

    broadcastOutput(sessionId: string, base64: string): void {
      Effect.runFork(terminalSubs.publish(sessionId, base64));
    },

    sendToCliClient(connId: string, msg: string): void {
      sendToCliClient(connId, msg);
    },

    bufferInput(
      sessionId: string,
      base64: string,
      source: 'cli' | 'browser',
      onLine: (text: string, source: 'cli' | 'browser', ts: number) => void
    ): void {
      stripAnsiAndBuffer(inputLineBuffers, sessionId, base64, source, onLine);
    },

    publishEvent(event: DomainEvent): Effect.Effect<void> {
      return eventPublisher.publish(event);
    },
  };
}
