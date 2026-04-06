export interface ScreenCell {
  readonly char: string;
  readonly width: number;
  readonly fg: number;
  readonly bg: number;
  readonly fgRGB: readonly [number, number, number] | null;
  readonly bgRGB: readonly [number, number, number] | null;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strikethrough: boolean;
  readonly dim: boolean;
  readonly inverse: boolean;
}

export interface ScreenLine {
  getCell(col: number): ScreenCell;
  readonly length: number;
}

export interface Screen {
  readonly cols: number;
  readonly rows: number;
  readonly cursorX: number;
  readonly cursorY: number;
  readonly cursorVisible: boolean;
  getLine(row: number): ScreenLine;
  getDirtyRows(): ReadonlySet<number>;
  markClean(): void;
}
