import { dlopen, ptr } from 'bun:ffi';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface PtyHandle {
  readonly fd: number;
  readonly pid: number;
}

interface PtyLibrary {
  spawn(command: string, args: string[], rows: number, cols: number): PtyHandle;
  read(fd: number): Uint8Array | null;
  write(fd: number, data: Uint8Array): number;
  resize(fd: number, rows: number, cols: number): void;
  close(fd: number): void;
  waitpid(pid: number): { exited: boolean; exitCode: number };
  kill(pid: number, signal: number): void;
  startStdinRelay(masterFd: number): boolean;
  stopStdinRelay(): void;
}

function cstr(s: string): Buffer {
  return Buffer.from(`${s}\0`);
}

function cstrArray(strs: string[]): Buffer {
  const buffers = strs.map((s) => cstr(s));
  const ptrSize = 8;
  const arr = Buffer.alloc((buffers.length + 1) * ptrSize);
  const ptrs = buffers.map((b) => ptr(b));
  for (let i = 0; i < ptrs.length; i++) {
    arr.writeBigUInt64LE(BigInt(ptrs[i]), i * ptrSize);
  }
  arr.writeBigUInt64LE(0n, buffers.length * ptrSize);
  return arr;
}

function findLibrary(): string {
  const os = process.platform;
  const ext = os === 'darwin' ? 'dylib' : 'so';
  const name = `libtmonier_pty.${ext}`;

  // Check relative to this file (development)
  const devPath = join(import.meta.dir, 'native', name);
  if (existsSync(devPath)) return devPath;

  // Check dist directory
  const distPath = join(process.cwd(), 'dist', name);
  if (existsSync(distPath)) return distPath;

  // Check next to the binary
  const binDir = join(import.meta.dir, '..', '..', '..', '..', '..', 'dist');
  const binPath = join(binDir, name);
  if (existsSync(binPath)) return binPath;

  throw new Error(`PTY native library not found. Run: sh scripts/build-pty.sh`);
}

export function createPtyLibrary(): PtyLibrary {
  const libPath = findLibrary();

  const ptyLib = dlopen(libPath, {
    pty_spawn: {
      args: ['ptr', 'ptr', 'int', 'int', 'ptr'],
      returns: 'int',
    },
    pty_resize: {
      args: ['int', 'int', 'int'],
      returns: 'int',
    },
    pty_start_stdin_relay: {
      args: ['int'],
      returns: 'int',
    },
    pty_stop_stdin_relay: {
      args: [],
      returns: 'int',
    },
  });

  const libc = dlopen('/usr/lib/libSystem.B.dylib', {
    read: { args: ['int', 'ptr', 'u64'], returns: 'i64' },
    write: { args: ['int', 'ptr', 'u64'], returns: 'i64' },
    close: { args: ['int'], returns: 'int' },
    waitpid: { args: ['int', 'ptr', 'int'], returns: 'int' },
    kill: { args: ['int', 'int'], returns: 'int' },
    fcntl: { args: ['int', 'int', 'int'], returns: 'int' },
    poll: { args: ['ptr', 'u32', 'int'], returns: 'int' },
  });

  const WNOHANG = 1;
  const F_SETFL = 4;
  const F_GETFL = 3;
  const O_NONBLOCK = 0x0004;
  const POLLIN = 0x0001;

  return {
    spawn(command, args, rows, cols) {
      const cmdBuf = cstr(command);
      const argvBuf = cstrArray(args);
      const pidBuf = new Int32Array(1);

      const fd = ptyLib.symbols.pty_spawn(ptr(cmdBuf), ptr(argvBuf), rows, cols, ptr(pidBuf));

      if (fd < 0) {
        throw new Error(`pty_spawn failed for command: ${command}`);
      }

      // Set O_NONBLOCK properly (preserve existing flags)
      const flags = libc.symbols.fcntl(fd, F_GETFL, 0);
      libc.symbols.fcntl(fd, F_SETFL, flags | O_NONBLOCK);

      return { fd, pid: pidBuf[0] };
    },

    read(fd) {
      // Use poll() with 0ms timeout to check if data is available before reading.
      // This avoids blocking even if O_NONBLOCK fails to take effect on the fd.
      // struct pollfd { int fd; short events; short revents; } = 8 bytes
      const pollBuf = new ArrayBuffer(8);
      const pollView = new DataView(pollBuf);
      pollView.setInt32(0, fd, true); // fd
      pollView.setInt16(4, POLLIN, true); // events
      pollView.setInt16(6, 0, true); // revents

      const pollResult = libc.symbols.poll(ptr(new Uint8Array(pollBuf)), 1, 0);
      if (pollResult <= 0) return null; // no data available or error

      const buf = new Uint8Array(16384);
      const n = Number(libc.symbols.read(fd, ptr(buf), buf.length));
      if (n <= 0) return null;
      return buf.subarray(0, n);
    },

    write(fd, data) {
      return Number(libc.symbols.write(fd, ptr(data), data.length));
    },

    resize(fd, rows, cols) {
      ptyLib.symbols.pty_resize(fd, rows, cols);
    },

    close(fd) {
      libc.symbols.close(fd);
    },

    waitpid(pid) {
      const statusBuf = new Int32Array(1);
      const result = libc.symbols.waitpid(pid, ptr(statusBuf), WNOHANG);
      if (result === 0) {
        return { exited: false, exitCode: -1 };
      }
      return { exited: true, exitCode: (statusBuf[0] >> 8) & 0xff };
    },

    kill(pid, signal) {
      libc.symbols.kill(pid, signal);
    },

    startStdinRelay(masterFd) {
      return ptyLib.symbols.pty_start_stdin_relay(masterFd) === 0;
    },

    stopStdinRelay() {
      ptyLib.symbols.pty_stop_stdin_relay();
    },
  };
}
