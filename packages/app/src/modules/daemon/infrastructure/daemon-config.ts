import { homedir } from 'node:os';
import { join } from 'node:path';
import { Layer, ServiceMap } from 'effect';

export interface DaemonConfigShape {
  readonly version: string;
  readonly vigieHome: string;
  readonly pidFile: string;
  readonly logFile: string;
  readonly socketPath: string;
  readonly stdinSocketPath: string;
  readonly dbFile: string;
  readonly portFile: string;
  readonly port: number;
}

export class DaemonConfig extends ServiceMap.Service<DaemonConfig, DaemonConfigShape>()(
  '@vigie/DaemonConfig'
) {}

export const DaemonConfigLive = Layer.sync(DaemonConfig)(() => {
  const vigieHome = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');
  const rawPort = process.env.VIGIE_PORT;
  const port = rawPort ? parseInt(rawPort, 10) || 19191 : 19191;
  return {
    version: '0.3.0',
    vigieHome,
    pidFile: join(vigieHome, 'daemon.pid'),
    logFile: join(vigieHome, 'daemon.log'),
    socketPath: join(vigieHome, 'daemon.sock'),
    stdinSocketPath: join(vigieHome, 'daemon-stdin.sock'),
    dbFile: join(vigieHome, 'data.db'),
    portFile: join(vigieHome, 'port'),
    port,
  };
});
