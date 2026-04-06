import type { ScreenCell } from './screen.js';

export function moveTo(row: number, col: number): string {
  return `\x1b[${row};${col}H`;
}

export function resetSGR(): string {
  return '\x1b[0m';
}

export function enterAltScreen(): string {
  return '\x1b[?1049h';
}

export function exitAltScreen(): string {
  return '\x1b[?1049l';
}

export function hideCursor(): string {
  return '\x1b[?25l';
}

export function showCursor(): string {
  return '\x1b[?25h';
}

export function eraseToEOL(): string {
  return '\x1b[K';
}

export function cellSGR(cell: ScreenCell): string {
  const parts: number[] = [0];

  if (cell.bold) parts.push(1);
  if (cell.dim) parts.push(2);
  if (cell.italic) parts.push(3);
  if (cell.underline) parts.push(4);
  if (cell.inverse) parts.push(7);
  if (cell.strikethrough) parts.push(9);

  if (cell.fgRGB !== null) {
    parts.push(38, 2, cell.fgRGB[0], cell.fgRGB[1], cell.fgRGB[2]);
  } else if (cell.fg >= 0) {
    parts.push(38, 5, cell.fg);
  }

  if (cell.bgRGB !== null) {
    parts.push(48, 2, cell.bgRGB[0], cell.bgRGB[1], cell.bgRGB[2]);
  } else if (cell.bg >= 0) {
    parts.push(48, 5, cell.bg);
  }

  return `\x1b[${parts.join(';')}m`;
}
