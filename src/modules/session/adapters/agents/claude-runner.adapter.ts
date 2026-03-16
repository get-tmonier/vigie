import { Stream } from 'effect';
import * as v from 'valibot';
import { ClaudeStreamEventSchema } from '#schemas/claude-stream.js';
import { AgentRunnerError } from '../../domain/errors.js';
import type { AgentChunk, AgentRunnerShape } from '../../ports/agent-runner.port.js';

function mapClaudeEvent(
  event: v.InferOutput<typeof ClaudeStreamEventSchema>,
  onSessionId?: (sessionId: string) => void
): AgentChunk | null {
  const timestamp = Date.now();

  switch (event.type) {
    case 'assistant': {
      if (event.message.type === 'thinking') {
        return { chunkType: 'thinking', data: event.message.text, timestamp };
      }
      return { chunkType: 'text', data: event.message.text, timestamp };
    }
    case 'tool_use': {
      const input = event.tool.input ? JSON.stringify(event.tool.input) : '';
      return { chunkType: 'tool_use', data: `${event.tool.name} ${input}`.trim(), timestamp };
    }
    case 'tool_result': {
      const content = event.content ? JSON.stringify(event.content) : '';
      return { chunkType: 'tool_result', data: content, timestamp };
    }
    case 'result': {
      if (event.session_id) onSessionId?.(event.session_id);
      const parts: string[] = [];
      if (event.result) parts.push(event.result);
      if (event.cost) {
        const { input_tokens, output_tokens } = event.cost;
        parts.push(`tokens: ${input_tokens ?? 0} in / ${output_tokens ?? 0} out`);
      }
      if (event.duration_ms) parts.push(`duration: ${event.duration_ms}ms`);
      return { chunkType: 'status', data: parts.join(' | '), timestamp };
    }
    case 'system': {
      if (event.session_id) onSessionId?.(event.session_id);
      return null;
    }
  }
}

async function* spawnClaude(
  prompt: string,
  cwd: string,
  onSessionId?: (sessionId: string) => void
): AsyncGenerator<AgentChunk, void, unknown> {
  const proc = Bun.spawn(['claude', '--output-format', 'stream-json', '--verbose', '-p', prompt], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let buffer = '';
  const stderrChunks: string[] = [];

  // Read stderr in background
  const stderrPromise = (async () => {
    if (!proc.stderr) return;
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stderrChunks.push(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
  })();

  if (proc.stdout) {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        for (
          let newlineIdx = buffer.indexOf('\n');
          newlineIdx !== -1;
          newlineIdx = buffer.indexOf('\n')
        ) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);

          if (!line) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }

          const result = v.safeParse(ClaudeStreamEventSchema, parsed);
          if (!result.success) continue;

          const chunk = mapClaudeEvent(result.output, onSessionId);
          if (chunk) yield chunk;
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          const result = v.safeParse(ClaudeStreamEventSchema, parsed);
          if (result.success) {
            const chunk = mapClaudeEvent(result.output);
            if (chunk) yield chunk;
          }
        } catch {}
      }
    } finally {
      reader.releaseLock();
    }
  }

  await stderrPromise;
  const exitCode = await proc.exited;

  if (stderrChunks.length > 0) {
    const stderr = stderrChunks.join('').trim();
    if (stderr) {
      yield { chunkType: 'error', data: stderr, timestamp: Date.now() };
    }
  }

  if (exitCode !== 0) {
    throw new AgentRunnerError({ message: `Claude exited with code ${exitCode}` });
  }
}

export function createClaudeRunner(): AgentRunnerShape {
  return {
    spawn: ({ prompt, cwd, onSessionId }) => {
      const iterable: AsyncIterable<AgentChunk> = {
        [Symbol.asyncIterator]: () => spawnClaude(prompt, cwd, onSessionId),
      };
      return Stream.fromAsyncIterable(iterable, (err) =>
        err instanceof AgentRunnerError
          ? err
          : new AgentRunnerError({
              message: `Claude spawn failed: ${err instanceof Error ? err.message : String(err)}`,
            })
      );
    },
  };
}
