import type { IBufferCell } from '@xterm/headless';
import { Terminal } from '@xterm/headless';
import type { Screen, ScreenCell, ScreenLine } from './screen.js';

interface VTerm {
  write(data: Uint8Array | string, onFlush?: () => void): void;
  getScreen(): Screen;
  resize(cols: number, rows: number): void;
  dispose(): void;
}

const DEFAULT_CELL: ScreenCell = {
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

function bufferCellToScreenCell(cell: IBufferCell): ScreenCell {
  const fgMode = cell.isFgRGB();
  const bgMode = cell.isBgRGB();
  const fg = cell.getFgColor();
  const bg = cell.getBgColor();

  return {
    char: cell.getChars() || ' ',
    width: cell.getWidth(),
    fg: fgMode ? -1 : cell.isFgPalette() ? fg : -1,
    bg: bgMode ? -1 : cell.isBgPalette() ? bg : -1,
    fgRGB: fgMode ? [(fg >>> 16) & 0xff, (fg >>> 8) & 0xff, fg & 0xff] : null,
    bgRGB: bgMode ? [(bg >>> 16) & 0xff, (bg >>> 8) & 0xff, bg & 0xff] : null,
    bold: cell.isBold() !== 0,
    italic: cell.isItalic() !== 0,
    underline: cell.isUnderline() !== 0,
    strikethrough: cell.isStrikethrough() !== 0,
    dim: cell.isDim() !== 0,
    inverse: cell.isInverse() !== 0,
  };
}

export function createVTerm(opts: { cols: number; rows: number }): VTerm {
  const terminal = new Terminal({
    cols: opts.cols,
    rows: opts.rows,
    allowProposedApi: true,
    scrollback: 1000,
  });

  const dirtyRows = new Set<number>();
  let currentRows = opts.rows;
  let cursorVisible = true;

  // Mark all rows dirty initially
  for (let i = 0; i < opts.rows; i++) {
    dirtyRows.add(i);
  }

  let prevCursorY = 0;
  const disposables: { dispose(): void }[] = [];

  // Event-driven dirty tracking: cursor move → mark old + new row
  disposables.push(
    terminal.onCursorMove(() => {
      dirtyRows.add(prevCursorY);
      dirtyRows.add(terminal.buffer.active.cursorY);
      prevCursorY = terminal.buffer.active.cursorY;
    })
  );

  // Line feed → mark old + new row
  disposables.push(
    terminal.onLineFeed(() => {
      dirtyRows.add(prevCursorY);
      dirtyRows.add(terminal.buffer.active.cursorY);
      prevCursorY = terminal.buffer.active.cursorY;
    })
  );

  // Scroll → all rows stale
  disposables.push(terminal.onScroll(() => markAllDirty()));

  // Track cursor visibility via DECTCEM (DEC Private Mode 25)
  // Also mark all dirty for alt screen switches (modes 1049/47/1047)
  disposables.push(
    terminal.parser.registerCsiHandler({ prefix: '?', final: 'h' }, (params) => {
      for (let i = 0; i < params.length; i++) {
        if (params[i] === 25) {
          cursorVisible = true;
        }
        if (params[i] === 1049 || params[i] === 47 || params[i] === 1047) {
          markAllDirty();
        }
      }
      return false;
    })
  );
  disposables.push(
    terminal.parser.registerCsiHandler({ prefix: '?', final: 'l' }, (params) => {
      for (let i = 0; i < params.length; i++) {
        if (params[i] === 25) {
          cursorVisible = false;
        }
        if (params[i] === 1049 || params[i] === 47 || params[i] === 1047) {
          markAllDirty();
        }
      }
      return false;
    })
  );

  // CSI hooks for cursor positioning — mark visited rows dirty.
  // onCursorMove only fires for NET movement; these catch intermediate visits.
  // CSI H (CUP) / CSI f (HVP) — absolute cursor position: param[0]=row (1-indexed)
  for (const final of ['H', 'f']) {
    disposables.push(
      terminal.parser.registerCsiHandler({ final }, (params) => {
        const row = (params.length > 0 && typeof params[0] === 'number' ? params[0] : 1) - 1;
        dirtyRows.add(Math.max(0, Math.min(row, currentRows - 1)));
        return false;
      })
    );
  }
  // CSI d (VPA) — absolute row: param[0]=row (1-indexed)
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'd' }, (params) => {
      const row = (params.length > 0 && typeof params[0] === 'number' ? params[0] : 1) - 1;
      dirtyRows.add(Math.max(0, Math.min(row, currentRows - 1)));
      return false;
    })
  );
  // CSI A (CUU) — cursor up: mark destination row dirty
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'A' }, (params) => {
      const n = params.length > 0 && typeof params[0] === 'number' ? params[0] : 1;
      const row = Math.max(0, terminal.buffer.active.cursorY - n);
      dirtyRows.add(row);
      return false;
    })
  );
  // CSI B (CUD) — cursor down: mark destination row dirty
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'B' }, (params) => {
      const n = params.length > 0 && typeof params[0] === 'number' ? params[0] : 1;
      const row = Math.min(currentRows - 1, terminal.buffer.active.cursorY + n);
      dirtyRows.add(row);
      return false;
    })
  );
  // CSI K (EL) — erase in line: mark current row dirty
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'K' }, () => {
      dirtyRows.add(terminal.buffer.active.cursorY);
      return false;
    })
  );

  // CSI hooks for screen-wide operations → mark all dirty
  // CSI J — Erase in Display
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'J' }, () => {
      markAllDirty();
      return false;
    })
  );
  // CSI L — Insert Lines
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'L' }, () => {
      markAllDirty();
      return false;
    })
  );
  // CSI M — Delete Lines
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'M' }, () => {
      markAllDirty();
      return false;
    })
  );
  // CSI r — Set Scroll Region
  disposables.push(
    terminal.parser.registerCsiHandler({ final: 'r' }, () => {
      markAllDirty();
      return false;
    })
  );

  const reusableCell = terminal.buffer.active.getLine(0)?.getCell(0);

  function markAllDirty() {
    for (let i = 0; i < currentRows; i++) {
      dirtyRows.add(i);
    }
  }

  return {
    write(data: Uint8Array | string, onFlush?: () => void) {
      prevCursorY = terminal.buffer.active.cursorY;
      const len = typeof data === 'string' ? data.length : data.byteLength;
      terminal.write(data, () => {
        if (len > 256) {
          markAllDirty();
        } else {
          dirtyRows.add(terminal.buffer.active.cursorY);
        }
        onFlush?.();
      });
    },

    getScreen(): Screen {
      const buffer = terminal.buffer.active;
      const cellRef = reusableCell;

      return {
        cols: terminal.cols,
        rows: terminal.rows,
        cursorX: buffer.cursorX,
        cursorY: buffer.cursorY,
        cursorVisible,

        getLine(row: number): ScreenLine {
          const line = buffer.getLine(row + buffer.viewportY);
          if (!line) {
            return {
              length: terminal.cols,
              getCell(_col: number): ScreenCell {
                return DEFAULT_CELL;
              },
            };
          }
          return {
            length: line.length,
            getCell(col: number): ScreenCell {
              if (!cellRef || !line.getCell(col, cellRef)) {
                return DEFAULT_CELL;
              }
              return bufferCellToScreenCell(cellRef);
            },
          };
        },

        getDirtyRows(): ReadonlySet<number> {
          return dirtyRows;
        },

        markClean() {
          dirtyRows.clear();
        },
      };
    },

    resize(cols: number, rows: number) {
      terminal.resize(cols, rows);
      currentRows = rows;
      dirtyRows.clear();
      markAllDirty();
    },

    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
      terminal.dispose();
    },
  };
}
