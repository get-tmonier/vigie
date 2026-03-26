import { describe, expect, it, mock } from 'bun:test';
import { createKeybindInterceptor } from '../terminal/keybind-interceptor.js';

describe('keybind-interceptor', () => {
  it('passes through normal input', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const result = interceptor.process(Buffer.from('hello'));
    expect(result).toEqual(Buffer.from('hello'));
    expect(onDetach).not.toHaveBeenCalled();
  });

  it('detects Ctrl-B d in same chunk', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const result = interceptor.process(Buffer.from([0x02, 0x64]));
    expect(result).toBeNull();
    expect(onDetach).toHaveBeenCalledTimes(1);
  });

  it('detects Ctrl-B D (uppercase) in same chunk', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const result = interceptor.process(Buffer.from([0x02, 0x44]));
    expect(result).toBeNull();
    expect(onDetach).toHaveBeenCalledTimes(1);
  });

  it('detects Ctrl-B d across two chunks', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const first = interceptor.process(Buffer.from([0x02]));
    expect(first).toBeNull();
    expect(onDetach).not.toHaveBeenCalled();
    const second = interceptor.process(Buffer.from([0x64]));
    expect(second).toBeNull();
    expect(onDetach).toHaveBeenCalledTimes(1);
  });

  it('flushes Ctrl-B when followed by non-d', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const first = interceptor.process(Buffer.from([0x02]));
    expect(first).toBeNull();
    const second = interceptor.process(Buffer.from([0x61])); // 'a'
    expect(second).toEqual(Buffer.from([0x02, 0x61]));
    expect(onDetach).not.toHaveBeenCalled();
  });

  it('returns data before Ctrl-B d in same chunk', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const result = interceptor.process(Buffer.from([0x68, 0x69, 0x02, 0x64])); // "hi" + Ctrl-B d
    expect(result).toEqual(Buffer.from([0x68, 0x69]));
    expect(onDetach).toHaveBeenCalledTimes(1);
  });

  it('passes through Ctrl-B followed by non-d in same chunk', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    const result = interceptor.process(Buffer.from([0x02, 0x61])); // Ctrl-B + 'a'
    expect(result).toEqual(Buffer.from([0x02, 0x61]));
    expect(onDetach).not.toHaveBeenCalled();
  });

  it('resets state on destroy', () => {
    const onDetach = mock(() => {});
    const interceptor = createKeybindInterceptor({ onDetach });
    interceptor.process(Buffer.from([0x02])); // enter PREFIX
    interceptor.destroy();
    const result = interceptor.process(Buffer.from([0x64])); // 'd' after destroy
    expect(result).toEqual(Buffer.from([0x64]));
    expect(onDetach).not.toHaveBeenCalled();
  });
});
