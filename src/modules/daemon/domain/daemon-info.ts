export interface DaemonInfo {
  readonly pid: number;
  readonly socketPath: string;
  readonly startedAt: number;
  readonly hostname: string;
  readonly version: string;
}
