import type { AgentChunk } from '#modules/session/ports/agent-runner.port.js';

const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

export function printChunk(chunk: AgentChunk) {
  switch (chunk.chunkType) {
    case 'text': {
      process.stdout.write(chunk.data);
      break;
    }
    case 'thinking': {
      process.stdout.write(`${DIM}${ITALIC}[thinking] ${chunk.data}${RESET}\n`);
      break;
    }
    case 'tool_use': {
      const parts = chunk.data.split(' ');
      const toolName = parts[0];
      const input = parts.slice(1).join(' ');
      const truncated = input.length > 120 ? `${input.slice(0, 120)}...` : input;
      process.stdout.write(`${CYAN}${BOLD}\u25b6 ${toolName}${RESET}`);
      if (truncated) {
        process.stdout.write(` ${DIM}${truncated}${RESET}`);
      }
      process.stdout.write('\n');
      break;
    }
    case 'tool_result': {
      const truncated = chunk.data.length > 200 ? `${chunk.data.slice(0, 200)}...` : chunk.data;
      process.stdout.write(`${GREEN}${DIM}  \u2190 ${truncated}${RESET}\n`);
      break;
    }
    case 'status': {
      process.stdout.write(`\n${YELLOW}${chunk.data}${RESET}\n`);
      break;
    }
    case 'error': {
      process.stderr.write(`${RED}[error] ${chunk.data}${RESET}\n`);
      break;
    }
  }
}
