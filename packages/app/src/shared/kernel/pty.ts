export interface PtyHandle {
  readonly pid: number;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onOutput(callback: (data: Uint8Array) => void): void;
  wait(): Promise<number>;
}
