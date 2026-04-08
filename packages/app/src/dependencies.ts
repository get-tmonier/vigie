import { homedir } from 'node:os';
import { join } from 'node:path';
import { Layer } from 'effect';
import { AgentSessionLive } from '#modules/agent-session/dependencies';
import { DaemonLive, runDaemon } from '#modules/daemon/dependencies';
import { makeDatabaseLayer } from '#shared/db/database';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

const DatabaseLive = makeDatabaseLayer(`${_HOME}/data.db`);

export const AppLive = AgentSessionLive.pipe(
  Layer.provide(DaemonLive),
  Layer.provide(DatabaseLive)
);

export { runDaemon };
