// Back-channel to the vigie CLI client currently attached to a session (via IPC).
// Used to send terminal output back to the `vigie session attach` process.
import { ServiceMap } from 'effect';

interface CliChannelShape {
  send(connId: string, msg: string): void;
}

export class CliChannel extends ServiceMap.Service<CliChannel, CliChannelShape>()(
  '@vigie/CliChannel'
) {}
