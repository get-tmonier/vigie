const CTRL_B = 0x02;
const CHAR_d = 0x64;
const CHAR_D = 0x44;

interface KeybindInterceptorOptions {
  onDetach: () => void;
}

interface KeybindInterceptor {
  process(chunk: Buffer | Uint8Array): Buffer | null;
  destroy(): void;
}

type State = 'NORMAL' | 'PREFIX';

export function createKeybindInterceptor(options: KeybindInterceptorOptions): KeybindInterceptor {
  let state: State = 'NORMAL';

  return {
    process(chunk: Buffer | Uint8Array): Buffer | null {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      if (state === 'PREFIX') {
        if (buf.length > 0 && (buf[0] === CHAR_d || buf[0] === CHAR_D)) {
          state = 'NORMAL';
          options.onDetach();
          return null;
        }

        // Not 'd' — flush the held Ctrl-B + this chunk
        state = 'NORMAL';
        return Buffer.concat([Buffer.from([CTRL_B]), buf]);
      }

      // NORMAL state — scan for Ctrl-B
      const idx = buf.indexOf(CTRL_B);
      if (idx === -1) {
        return buf;
      }

      // Found Ctrl-B — check if 'd' follows immediately in the same chunk
      if (idx + 1 < buf.length) {
        const nextByte = buf[idx + 1];
        if (nextByte === CHAR_d || nextByte === CHAR_D) {
          options.onDetach();
          const before = buf.subarray(0, idx);
          return before.length > 0 ? before : null;
        }

        // Ctrl-B followed by something else in same chunk — pass through
        return buf;
      }

      // Ctrl-B at end of chunk — enter PREFIX state, no timeout
      state = 'PREFIX';

      const before = buf.subarray(0, idx);
      return before.length > 0 ? before : null;
    },

    destroy() {
      state = 'NORMAL';
    },
  };
}
