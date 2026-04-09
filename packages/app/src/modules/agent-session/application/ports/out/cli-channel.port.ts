import { ServiceMap } from 'effect';

interface CliChannelShape {
  send(connId: string, msg: string): void;
}

export class CliChannel extends ServiceMap.Service<CliChannel, CliChannelShape>()(
  '@vigie/CliChannel'
) {}
