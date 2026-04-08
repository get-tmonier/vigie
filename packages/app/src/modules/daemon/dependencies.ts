import { Layer } from 'effect';
import { UnixSocketServerLayer } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import { DaemonConfigLayer } from '#modules/daemon/infrastructure/daemon-config';

export const DaemonLayer = Layer.mergeAll(UnixSocketServerLayer, DaemonConfigLayer);
