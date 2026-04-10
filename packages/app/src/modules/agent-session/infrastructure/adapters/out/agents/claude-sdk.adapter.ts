import { spawn } from 'node:child_process';
import { Cause, Effect, Queue, Stream } from 'effect';
import { AgentRunnerError } from '#modules/agent-session/domain/errors';
import type { StructuredEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';
import { mapSdkMessage, resetMessageDedup } from './sdk-event-mapper';

interface SpawnStructuredOptions {
  sessionId: SessionId;
  prompt: string;
  cwd: string;
  autoAdvance: boolean;
  agentSessionId?: string;
  resume?: boolean;
  maxTurns?: number;
}

export function spawnStructured(
  options: SpawnStructuredOptions
): Stream.Stream<StructuredEvent, AgentRunnerError> {
  return Stream.callback<StructuredEvent, AgentRunnerError>((queue) =>
    Effect.sync(() => {
      const turnIndex = 0;
      resetMessageDedup();

      const args: string[] = ['--print', '--output-format', 'stream-json', options.prompt];

      if (options.agentSessionId && options.resume) {
        args.push('--resume', options.agentSessionId);
      }
      if (options.maxTurns !== undefined) {
        args.push('--max-turns', String(options.maxTurns));
      }

      const child = spawn('claude', args, { cwd: options.cwd });

      let buffer = '';

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          const result = mapSdkMessage(options.sessionId, turnIndex, parsed);

          if (result.kind === 'session-id-detected') {
            Queue.offerUnsafe(queue, {
              type: 'agent:turn-started',
              sessionId: options.sessionId,
              turnIndex,
              prompt: options.prompt,
              mode: options.autoAdvance ? 'auto' : 'manual',
              timestamp: Date.now(),
            });
          } else if (result.kind === 'events') {
            for (const event of result.events) {
              Queue.offerUnsafe(queue, event);
            }
          } else if (result.kind === 'turn-completed') {
            Queue.offerUnsafe(queue, {
              type: 'agent:turn-completed',
              sessionId: options.sessionId,
              turnIndex,
              stopReason: result.stopReason,
              timestamp: Date.now(),
            });
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        Queue.failCauseUnsafe(queue, Cause.fail(new AgentRunnerError({ message: text })));
      });

      child.on('error', (err: Error) => {
        Queue.failCauseUnsafe(queue, Cause.fail(new AgentRunnerError({ message: err.message })));
      });

      child.on('close', () => {
        Queue.endUnsafe(queue);
      });

      return child.kill.bind(child);
    })
  );
}
