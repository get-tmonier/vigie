import { Layer } from 'effect';
import { UnixSocketServerLive } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import { DaemonConfigLive } from '#modules/daemon/infrastructure/daemon-config';

export const DaemonLayer = Layer.mergeAll(UnixSocketServerLive, DaemonConfigLive);
