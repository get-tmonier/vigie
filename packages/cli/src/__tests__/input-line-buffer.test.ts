import { describe, expect, it } from 'bun:test';
import type { LineBuffer } from '../modules/daemon/input-line-buffer.js';
import { stripAnsiAndBuffer } from '../modules/daemon/input-line-buffer.js';

function toBase64(str: string): string {
  return Buffer.from(str).toString('base64');
}

describe('stripAnsiAndBuffer', () => {
  it('extracts a plain line on enter', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    stripAnsiAndBuffer(buffers, 's1', toBase64('hello\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['hello']);
  });

  it('handles backspace correctly', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    stripAnsiAndBuffer(buffers, 's1', toBase64('helloo\x7f\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['hello']);
  });

  it('strips CSI escape sequences', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    // ESC[?1;2c is a device attributes response
    stripAnsiAndBuffer(buffers, 's1', toBase64('ls\x1b[?1;2c\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['ls']);
  });

  it('strips SS3 escape sequences', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    // ESC O P is an SS3 function key
    stripAnsiAndBuffer(buffers, 's1', toBase64('cmd\x1bOP\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['cmd']);
  });

  it('strips color/SGR sequences', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    // ESC[32m ... ESC[0m (green text)
    stripAnsiAndBuffer(buffers, 's1', toBase64('\x1b[32mhello\x1b[0m\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['hello']);
  });

  it('buffers across multiple calls', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    const cb = (text: string) => lines.push(text);
    stripAnsiAndBuffer(buffers, 's1', toBase64('hel'), 'cli', cb);
    expect(lines).toEqual([]);
    stripAnsiAndBuffer(buffers, 's1', toBase64('lo\r'), 'cli', cb);
    expect(lines).toEqual(['hello']);
  });

  it('ignores empty lines', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    stripAnsiAndBuffer(buffers, 's1', toBase64('\r\n\r\n'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual([]);
  });

  it('handles multiple lines in one chunk', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    stripAnsiAndBuffer(buffers, 's1', toBase64('foo\rbar\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['foo', 'bar']);
  });

  it('ignores control characters below 0x20', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    stripAnsiAndBuffer(buffers, 's1', toBase64('he\x01\x02llo\r'), 'cli', (text) => {
      lines.push(text);
    });
    expect(lines).toEqual(['hello']);
  });

  it('passes source and returns timestamp', () => {
    const buffers = new Map<string, LineBuffer>();
    const results: Array<{ text: string; source: string }> = [];
    stripAnsiAndBuffer(buffers, 's1', toBase64('cmd\r'), 'browser', (text, source) => {
      results.push({ text, source });
    });
    expect(results).toEqual([{ text: 'cmd', source: 'browser' }]);
  });

  it('maintains separate buffers per session', () => {
    const buffers = new Map<string, LineBuffer>();
    const lines: string[] = [];
    const cb = (text: string) => lines.push(text);
    stripAnsiAndBuffer(buffers, 's1', toBase64('foo'), 'cli', cb);
    stripAnsiAndBuffer(buffers, 's2', toBase64('bar\r'), 'cli', cb);
    expect(lines).toEqual(['bar']);
    stripAnsiAndBuffer(buffers, 's1', toBase64('\r'), 'cli', cb);
    expect(lines).toEqual(['bar', 'foo']);
  });
});
