export interface AttachResult {
  chunks: Array<{ data: string }>;
  pid: number;
}

export interface TerminalConnectionShape {
  kill(sessionId: string): void;
  killAll(): void;
  attach(
    sessionId: string,
    connId: string,
    dims: { cols: number; rows: number }
  ): AttachResult | null;
  detach(sessionId: string, connId: string): void;
  updateCliResize(sessionId: string, connId: string, cols: number, rows: number): void;
  handleDisconnect(connId: string): void;
  writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void;
  applyResizePriority(sessionId: string): { cols: number; rows: number } | null;
  addBrowserChannel(
    sessionId: string,
    connId: string,
    dims: { cols: number; rows: number }
  ): number | null;
  updateBrowserChannel(
    sessionId: string,
    connId: string,
    dims: { cols: number; rows: number }
  ): void;
  removeBrowserChannel(sessionId: string, connId: string): void;
  writeBinaryInput(sessionId: string, data: Uint8Array): void;
}
