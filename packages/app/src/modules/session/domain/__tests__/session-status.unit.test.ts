import { describe, expect, it } from 'bun:test';
import type { SessionStatus } from '../session-status';
import { canTransition } from '../session-status';

const ALL_STATUSES: SessionStatus[] = ['registering', 'active', 'ended', 'error'];

describe('canTransition', () => {
  describe('from registering', () => {
    it('registering → active = true', () =>
      expect(canTransition('registering', 'active')).toBe(true));
    it('registering → ended = true', () =>
      expect(canTransition('registering', 'ended')).toBe(true));
    it('registering → error = true', () =>
      expect(canTransition('registering', 'error')).toBe(true));
    it('registering → registering = false', () =>
      expect(canTransition('registering', 'registering')).toBe(false));
  });

  describe('from active', () => {
    it('active → ended = true', () => expect(canTransition('active', 'ended')).toBe(true));
    it('active → error = true', () => expect(canTransition('active', 'error')).toBe(true));
    it('active → active = false', () => expect(canTransition('active', 'active')).toBe(false));
    it('active → registering = false', () =>
      expect(canTransition('active', 'registering')).toBe(false));
  });

  describe('from ended', () => {
    it('ended → active = true (resume)', () => expect(canTransition('ended', 'active')).toBe(true));
    it('ended → ended = false', () => expect(canTransition('ended', 'ended')).toBe(false));
    it('ended → error = false', () => expect(canTransition('ended', 'error')).toBe(false));
    it('ended → registering = false', () =>
      expect(canTransition('ended', 'registering')).toBe(false));
  });

  describe('from error', () => {
    for (const to of ALL_STATUSES) {
      it(`error → ${to} = false`, () => expect(canTransition('error', to)).toBe(false));
    }
  });
});
