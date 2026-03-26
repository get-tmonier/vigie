import type { createTuiRenderer } from '#vterm/tui-renderer.js';

type TuiRenderer = ReturnType<typeof createTuiRenderer>;

let titleInterval: ReturnType<typeof setInterval> | undefined;
let barSessionId = '';
let barStartedAt = 0;
let barInfo = '';
let rendererRef: TuiRenderer | null = null;

function setTerminalTitle(title: string) {
  // Window title (OSC 0) — safe, processed by terminal emulator, not the PTY app
  process.stdout.write(`\x1b]0;${title}\x07`);
  // Tab title (OSC 1) — same safety guarantees
  process.stdout.write(`\x1b]1;${title}\x07`);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function updateBar() {
  const shortId = barSessionId.slice(0, 8);
  const elapsed = formatElapsed(Date.now() - barStartedAt);
  setTerminalTitle(`\u2699 vigie | ${shortId} | ${elapsed}`);
  const infoSuffix = barInfo ? ` | ${barInfo}` : '';
  rendererRef?.setStatusBar(`\u2699 vigie | ${shortId} | ${elapsed} | ^B d detach${infoSuffix}`);
}

export function initStatusBar(
  renderer: TuiRenderer,
  sessionId: string,
  startedAt: number,
  info?: string
) {
  rendererRef = renderer;
  barSessionId = sessionId;
  barStartedAt = startedAt;
  barInfo = info ?? '';

  updateBar();

  // Update bar every second with elapsed duration
  titleInterval = setInterval(updateBar, 1_000);
}

export function resizeStatusBar() {
  updateBar();
}

export function teardownStatusBar(isDetach: boolean) {
  if (titleInterval !== undefined) {
    clearInterval(titleInterval);
    titleInterval = undefined;
  }

  rendererRef = null;

  if (isDetach) {
    // Exit alt screen in case Claude Code didn't clean up
    process.stdout.write('\x1b[?1049l');
  }

  setTerminalTitle('Terminal');
}
