import { ServiceMap } from 'effect';

interface CliSenderShape {
  send: (connId: string, msg: string) => void;
}

/**
 * Port owned by agent-session (used by use cases to send messages back to the CLI).
 * Implemented by the daemon layer via callback injection at the composition root
 * (src/dependencies.ts), not by agent-session infrastructure — this is intentional
 * dependency inversion: the domain defines the port; the outer layer provides the adapter.
 */
export class CliSender extends ServiceMap.Service<CliSender, CliSenderShape>()(
  '@vigie/CliSender'
) {}
