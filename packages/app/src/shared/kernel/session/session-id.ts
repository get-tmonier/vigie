import { Brand } from 'effect';
import * as v from 'valibot';

export type SessionId = string & Brand.Brand<'SessionId'>;
export const SessionId = Brand.nominal<SessionId>();

export const SessionIdSchema = v.pipe(v.string(), v.transform(SessionId));
