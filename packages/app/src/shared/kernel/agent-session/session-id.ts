import { Brand } from 'effect';

export type SessionId = string & Brand.Brand<'SessionId'>;
export const SessionId = Brand.nominal<SessionId>();
