export type AnsiState = 'normal' | 'escape' | 'csi';

export interface LineBuffer {
  text: string;
  state: AnsiState;
}

export function stripAnsiAndBuffer(
  lineBuffers: Map<string, LineBuffer>,
  sessionId: string,
  base64Data: string,
  source: 'cli' | 'browser',
  onLine: (text: string, source: 'cli' | 'browser', timestamp: number) => void
): void {
  let buf = lineBuffers.get(sessionId);
  if (!buf) {
    buf = { text: '', state: 'normal' };
    lineBuffers.set(sessionId, buf);
  }
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

  for (const byte of bytes) {
    switch (buf.state) {
      case 'normal': {
        if (byte === 0x1b) {
          buf.state = 'escape';
        } else if (byte === 0x0d || byte === 0x0a) {
          const line = buf.text.trim();
          if (line.length > 0) {
            onLine(line, source, Date.now());
          }
          buf.text = '';
        } else if (byte === 0x7f || byte === 0x08) {
          buf.text = buf.text.slice(0, -1);
        } else if (byte >= 0x20) {
          buf.text += String.fromCharCode(byte);
        }
        break;
      }
      case 'escape': {
        if (byte === 0x5b) {
          buf.state = 'csi';
        } else if (byte === 0x4f || byte === 0x4e || byte === 0x5d) {
          buf.state = 'csi';
        } else {
          buf.state = 'normal';
        }
        break;
      }
      case 'csi': {
        if (byte >= 0x40 && byte <= 0x7e) {
          buf.state = 'normal';
        }
        break;
      }
    }
  }
}
