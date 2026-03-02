import type {
  CommandDone,
  CommandError,
  CommandOutput,
  CommandRequest,
} from '../schemas/messages.js';

type UpstreamMessage = CommandOutput | CommandDone | CommandError;

export async function executeCommand(
  request: CommandRequest,
  send: (msg: UpstreamMessage) => void
): Promise<void> {
  try {
    const proc = Bun.spawn(['sh', '-c', request.command], {
      cwd: request.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const readStream = async (
      stream: ReadableStream<Uint8Array> | null,
      streamName: 'stdout' | 'stderr'
    ) => {
      if (!stream) return;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          send({
            type: 'command:output',
            id: request.id,
            stream: streamName,
            data: decoder.decode(value, { stream: true }),
            timestamp: Date.now(),
          });
        }
      } finally {
        reader.releaseLock();
      }
    };

    await Promise.all([readStream(proc.stdout, 'stdout'), readStream(proc.stderr, 'stderr')]);

    const exitCode = await proc.exited;

    send({
      type: 'command:done',
      id: request.id,
      exitCode,
      timestamp: Date.now(),
    });
  } catch (err) {
    send({
      type: 'command:error',
      id: request.id,
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    });
  }
}
