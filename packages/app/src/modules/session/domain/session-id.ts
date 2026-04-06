export type SessionId = string & { readonly _brand: 'SessionId' };

export function SessionId(value: string): SessionId {
  return value as SessionId;
}
