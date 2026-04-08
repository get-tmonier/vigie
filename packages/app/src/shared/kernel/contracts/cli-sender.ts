import { ServiceMap } from 'effect';

interface CliSenderShape {
  send: (connId: string, msg: string) => void;
}

export class CliSender extends ServiceMap.Service<CliSender, CliSenderShape>()(
  '@vigie/CliSender'
) {}
