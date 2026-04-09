import type { SessionEvent } from '#shared/kernel/agent-session/events';
import type { ShellEvent } from '#shared/kernel/shell/events';

export type { SessionEvent } from '#shared/kernel/agent-session/events';
export type { ShellEvent } from '#shared/kernel/shell/events';

export type BrowserEvent = SessionEvent | ShellEvent;
