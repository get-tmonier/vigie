import { ServiceMap } from 'effect';

interface SessionSinkShape {
  send: (connId: string, msg: string) => void;
}

export class SessionSink extends ServiceMap.Service<SessionSink, SessionSinkShape>()(
  '@vigie/SessionSink'
) {}
