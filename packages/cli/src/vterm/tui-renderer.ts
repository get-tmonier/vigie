import {
  cellSGR,
  enterAltScreen,
  eraseToEOL,
  exitAltScreen,
  hideCursor,
  moveTo,
  resetSGR,
  showCursor,
} from './ansi.js';
import type { Screen, ScreenCell } from './screen.js';

interface TuiRenderer {
  render(screen: Screen): void;
  fullRender(screen: Screen): void;
  resize(cols: number, rows: number): void;
  setRowOffset(n: number): void;
  setStatusBar(text: string): void;
  activate(): void;
  deactivate(): void;
}

interface OutputWriter {
  write(data: string | Uint8Array): boolean;
}

function cellsEqual(a: ScreenCell, b: ScreenCell): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.dim === b.dim &&
    a.inverse === b.inverse &&
    a.fgRGB?.[0] === b.fgRGB?.[0] &&
    a.fgRGB?.[1] === b.fgRGB?.[1] &&
    a.fgRGB?.[2] === b.fgRGB?.[2] &&
    a.bgRGB?.[0] === b.bgRGB?.[0] &&
    a.bgRGB?.[1] === b.bgRGB?.[1] &&
    a.bgRGB?.[2] === b.bgRGB?.[2]
  );
}

const EMPTY_CELL: ScreenCell = {
  char: ' ',
  width: 1,
  fg: -1,
  bg: -1,
  fgRGB: null,
  bgRGB: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  dim: false,
  inverse: false,
};

function renderRows(
  screen: Screen,
  rows: Iterable<number>,
  cols: number,
  rowOffset: number
): string {
  let out = '';
  let lastSGR: ScreenCell = EMPTY_CELL;
  let firstCell = true;

  for (const row of rows) {
    if (row >= screen.rows) continue;
    const line = screen.getLine(row);
    out += moveTo(row - rowOffset + 1, 1);
    firstCell = true;

    for (let col = 0; col < cols; col++) {
      const cell = line.getCell(col);

      // Skip continuation cells (part of a wide character)
      if (cell.width === 0) continue;

      if (firstCell || !cellsEqual(lastSGR, cell)) {
        out += cellSGR(cell);
        lastSGR = cell;
        firstCell = false;
      }

      out += cell.char;
    }

    out += resetSGR() + eraseToEOL();
    lastSGR = EMPTY_CELL;
  }

  return out;
}

export function createTuiRenderer(opts: {
  cols: number;
  rows: number;
  reservedBottom?: number;
  output?: OutputWriter;
}): TuiRenderer {
  let cols = opts.cols;
  let rows = opts.rows;
  const reservedBottom = opts.reservedBottom ?? 0;
  let viewportRows = rows - reservedBottom;
  const output = opts.output ?? process.stdout;

  let rowOffset = 0;
  let barText = '';
  let barRendered = false;

  const BAR_SGR = '\x1b[30;43m'; // black on gold

  function renderBar(): string {
    if (reservedBottom === 0 || barText === '') return '';
    const padded = ` ${barText}`.slice(0, cols).padEnd(cols);
    return moveTo(viewportRows + 1, 1) + BAR_SGR + padded + resetSGR() + eraseToEOL();
  }

  return {
    render(screen: Screen) {
      const dirty = screen.getDirtyRows();
      const needsBar = reservedBottom > 0 && (!barRendered || barText !== '');
      if (dirty.size === 0 && !needsBar) return;
      let result = '';
      if (dirty.size > 0) {
        const viewportDirty: number[] = [];
        for (const r of dirty) {
          if (r >= rowOffset && r < rowOffset + viewportRows) viewportDirty.push(r);
        }
        if (viewportDirty.length > 0) {
          result = renderRows(screen, viewportDirty, cols, rowOffset);
        }
      }
      screen.markClean();
      if (!barRendered && reservedBottom > 0) {
        result += renderBar();
        barRendered = true;
      }
      const termLine = screen.cursorY - rowOffset + 1;
      if (screen.cursorVisible && termLine >= 1 && termLine <= viewportRows) {
        result += moveTo(termLine, screen.cursorX + 1);
        result += showCursor();
      } else {
        result += hideCursor();
      }
      output.write(result);
    },

    fullRender(screen: Screen) {
      const allRows: number[] = [];
      for (let i = rowOffset; i < rowOffset + viewportRows; i++) {
        allRows.push(i);
      }
      let result = renderRows(screen, allRows, cols, rowOffset);
      screen.markClean();
      if (reservedBottom > 0) {
        result += renderBar();
        barRendered = true;
      }
      const termLine = screen.cursorY - rowOffset + 1;
      if (screen.cursorVisible && termLine >= 1 && termLine <= viewportRows) {
        result += moveTo(termLine, screen.cursorX + 1);
        result += showCursor();
      } else {
        result += hideCursor();
      }
      output.write(result);
    },

    resize(newCols: number, newRows: number) {
      cols = newCols;
      rows = newRows;
      viewportRows = newRows - reservedBottom;
    },

    setRowOffset(n: number) {
      rowOffset = n;
    },

    setStatusBar(text: string) {
      barText = text;
      let out = renderBar();
      barRendered = true;
      // Don't move cursor — the next render() will reposition it
      out += hideCursor();
      output.write(out);
    },

    activate() {
      output.write(enterAltScreen() + hideCursor() + resetSGR());
    },

    deactivate() {
      output.write(resetSGR() + showCursor() + exitAltScreen());
    },
  };
}
