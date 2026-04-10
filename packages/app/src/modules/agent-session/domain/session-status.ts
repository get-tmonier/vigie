export type SessionStatus =
  | 'registering'
  | 'active'
  | 'paused'
  | 'ended'
  | 'error'
  | 'abandoned'
  | 'killed'
  | 'archived';

const VALID_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  registering: ['active', 'ended', 'error'],
  active: ['paused', 'ended', 'error', 'abandoned', 'killed'],
  paused: ['active', 'ended', 'error', 'abandoned', 'killed'],
  ended: ['active', 'archived'], // active = resume
  error: ['archived'],
  abandoned: ['archived'],
  killed: ['archived'],
  archived: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
