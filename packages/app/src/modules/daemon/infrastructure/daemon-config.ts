import { homedir } from 'node:os';
import { join } from 'node:path';
import { Config, Effect, Layer, ServiceMap } from 'effect';

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

export const DaemonConfigLayer = Layer.effect(
  DaemonConfig,
  Effect.gen(function* () {
    const vigieHome = yield* Config.string('VIGIE_HOME').pipe(
      Config.withDefault(join(homedir(), '.vigie'))
    );
    const port = yield* Config.int('VIGIE_PORT').pipe(Config.withDefault(19191));
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
  })
);
