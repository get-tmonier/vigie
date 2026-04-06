export type SessionStatus = 'registering' | 'active' | 'ended' | 'error';

const VALID_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  registering: ['active', 'ended', 'error'],
  active: ['ended', 'error'],
  ended: ['active'], // resume
  error: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
