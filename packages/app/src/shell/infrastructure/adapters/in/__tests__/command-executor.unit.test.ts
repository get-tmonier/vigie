import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type {
  CommandDoneEvent,
  CommandErrorEvent,
  CommandOutputEvent,
  CommandRequest,
} from '#shared/kernel/shell/events';
import { executeCommand } from '../command-executor';

type UpstreamMessage = CommandOutputEvent | CommandDoneEvent | CommandErrorEvent;

describe('executeCommand', () => {
  it('executes echo and streams stdout', async () => {
    const messages: UpstreamMessage[] = [];
    const request: CommandRequest = {
      type: 'command:request',
      id: 'test-1',
      command: 'echo hello',
    };

    await Effect.runPromise(executeCommand(request, (msg) => messages.push(msg)));

    const outputs = messages.filter((m) => m.type === 'command:output');
    const done = messages.find((m) => m.type === 'command:done');

    expect(outputs.length).toBeGreaterThanOrEqual(1);
    const combined = outputs.map((o) => (o as CommandOutputEvent).data).join('');
    expect(combined.trim()).toBe('hello');

    expect(done).toBeDefined();
    expect((done as CommandDoneEvent).exitCode).toBe(0);
  });

  it('captures stderr', async () => {
    const messages: UpstreamMessage[] = [];
    const request: CommandRequest = {
      type: 'command:request',
      id: 'test-2',
      command: 'echo err >&2',
    };

    await Effect.runPromise(executeCommand(request, (msg) => messages.push(msg)));

    const stderrOutputs = messages.filter(
      (m) => m.type === 'command:output' && (m as CommandOutputEvent).stream === 'stderr'
    );
    expect(stderrOutputs.length).toBeGreaterThanOrEqual(1);
  });

  it('reports non-zero exit code', async () => {
    const messages: UpstreamMessage[] = [];
    const request: CommandRequest = {
      type: 'command:request',
      id: 'test-3',
      command: 'exit 42',
    };

    await Effect.runPromise(executeCommand(request, (msg) => messages.push(msg)));

    const done = messages.find((m) => m.type === 'command:done') as CommandDoneEvent;
    expect(done).toBeDefined();
    expect(done.exitCode).toBe(42);
  });
});
