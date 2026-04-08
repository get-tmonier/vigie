import { homedir } from 'node:os';
import { join } from 'node:path';
import { Config } from 'effect';

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

const defaultVigieHome = join(homedir(), '.vigie');

export function resolveDefaultDaemonConfig(): DaemonConfigShape {
  const vigieHome = process.env.VIGIE_HOME ?? defaultVigieHome;
  const port = process.env.VIGIE_PORT !== undefined ? Number(process.env.VIGIE_PORT) : 19191;
  return {
    version: '0.3.0',
    vigieHome,
    port,
    pidFile: join(vigieHome, 'daemon.pid'),
    logFile: join(vigieHome, 'daemon.log'),
    socketPath: join(vigieHome, 'daemon.sock'),
    stdinSocketPath: join(vigieHome, 'daemon-stdin.sock'),
    dbFile: join(vigieHome, 'data.db'),
    portFile: join(vigieHome, 'port'),
  };
}

export const DaemonConfig = Config.all({
  vigieHome: Config.string('VIGIE_HOME').pipe(Config.withDefault(defaultVigieHome)),
  port: Config.port('VIGIE_PORT').pipe(Config.withDefault(19191)),
}).pipe(
  Config.map(
    ({ vigieHome, port }): DaemonConfigShape => ({
      version: '0.3.0',
      vigieHome,
      port,
      pidFile: join(vigieHome, 'daemon.pid'),
      logFile: join(vigieHome, 'daemon.log'),
      socketPath: join(vigieHome, 'daemon.sock'),
      stdinSocketPath: join(vigieHome, 'daemon-stdin.sock'),
      dbFile: join(vigieHome, 'data.db'),
      portFile: join(vigieHome, 'port'),
    })
  )
);
