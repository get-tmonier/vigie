import { CannotDeleteActiveSessionError, InvalidStatusTransitionError } from './errors';
import type { SessionDomainEvent } from './events';
import type { SessionId } from './session-id';
import { SessionId as makeSessionId } from './session-id';
import type { SessionStatus } from './session-status';
import { canTransition } from './session-status';

export type AgentType = 'claude' | 'aider' | 'codex' | 'generic' | (string & {});

/** @deprecated Use Session entity directly. Kept for backward compatibility during migration. */
export interface AgentSession {
  readonly id: string;
  readonly agentType: AgentType;
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly gitRemoteUrl?: string;
  readonly repoName?: string;
  readonly startedAt: number;
  readonly status: SessionStatus;
}

interface CreateSessionProps {
  readonly id?: string;
  readonly agentType: AgentType;
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly gitRemoteUrl?: string;
  readonly repoName?: string;
  readonly mode?: 'prompt' | 'interactive';
}

interface ReconstitutedSessionProps {
  readonly id: string;
  readonly agentType: AgentType;
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly gitRemoteUrl?: string;
  readonly repoName?: string;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly status: SessionStatus;
  readonly exitCode?: number;
  readonly claudeSessionId?: string;
  readonly resumable: boolean;
  readonly mode?: string;
}

export class Session {
  readonly id: SessionId;
  readonly agentType: AgentType;
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly gitRemoteUrl?: string;
  readonly repoName?: string;
  readonly startedAt: number;
  readonly mode: string;

  private _status: SessionStatus;
  private _claudeSessionId?: string;
  private _resumable: boolean;
  private _exitCode?: number;
  private _endedAt?: number;
  private readonly _events: SessionDomainEvent[] = [];

  private constructor(props: {
    id: SessionId;
    agentType: AgentType;
    cwd: string;
    gitBranch?: string;
    gitRemoteUrl?: string;
    repoName?: string;
    startedAt: number;
    status: SessionStatus;
    claudeSessionId?: string;
    resumable: boolean;
    exitCode?: number;
    endedAt?: number;
    mode: string;
  }) {
    this.id = props.id;
    this.agentType = props.agentType;
    this.cwd = props.cwd;
    this.gitBranch = props.gitBranch;
    this.gitRemoteUrl = props.gitRemoteUrl;
    this.repoName = props.repoName;
    this.startedAt = props.startedAt;
    this.mode = props.mode;
    this._status = props.status;
    this._claudeSessionId = props.claudeSessionId;
    this._resumable = props.resumable;
    this._exitCode = props.exitCode;
    this._endedAt = props.endedAt;
  }

  static create(props: CreateSessionProps): Session {
    const id = makeSessionId(props.id ?? crypto.randomUUID());
    const session = new Session({
      id,
      agentType: props.agentType,
      cwd: props.cwd,
      gitBranch: props.gitBranch,
      gitRemoteUrl: props.gitRemoteUrl,
      repoName: props.repoName,
      startedAt: Date.now(),
      status: 'active',
      resumable: false,
      mode: props.mode ?? 'prompt',
    });

    session._events.push({
      type: 'session:started',
      sessionId: session.id,
      agentType: session.agentType,
      mode: (props.mode ?? 'prompt') as 'prompt' | 'interactive',
      cwd: session.cwd,
      gitBranch: session.gitBranch,
      repoName: session.repoName,
      timestamp: session.startedAt,
    });

    return session;
  }

  static reconstitute(props: ReconstitutedSessionProps): Session {
    return new Session({
      id: makeSessionId(props.id),
      agentType: props.agentType,
      cwd: props.cwd,
      gitBranch: props.gitBranch,
      gitRemoteUrl: props.gitRemoteUrl,
      repoName: props.repoName,
      startedAt: props.startedAt,
      status: props.status,
      claudeSessionId: props.claudeSessionId,
      resumable: props.resumable,
      exitCode: props.exitCode,
      endedAt: props.endedAt,
      mode: props.mode ?? 'prompt',
    });
  }

  get status(): SessionStatus {
    return this._status;
  }

  get isActive(): boolean {
    return this._status === 'active';
  }

  get claudeSessionId(): string | undefined {
    return this._claudeSessionId;
  }

  get resumable(): boolean {
    return this._resumable;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  get endedAt(): number | undefined {
    return this._endedAt;
  }

  get canResume(): boolean {
    return this._status === 'ended' && this._resumable && this._claudeSessionId != null;
  }

  get canDelete(): boolean {
    return this._status !== 'active';
  }

  markActive(): void {
    this.transitionTo('active');
  }

  markEnded(exitCode: number, resumable: boolean): void {
    this.transitionTo('ended');
    this._exitCode = exitCode;
    this._endedAt = Date.now();
    this._resumable = resumable;

    this._events.push({
      type: 'session:ended',
      sessionId: this.id,
      exitCode,
      resumable,
      timestamp: this._endedAt,
    });
  }

  markError(error: string): void {
    this.transitionTo('error');
    this._exitCode = -1;
    this._endedAt = Date.now();
    this._resumable = false;

    this._events.push({
      type: 'session:error',
      sessionId: this.id,
      error,
      timestamp: this._endedAt,
    });
  }

  reactivate(): void {
    this.transitionTo('active');
    this._endedAt = undefined;
    this._exitCode = undefined;

    this._events.push({
      type: 'session:started',
      sessionId: this.id,
      agentType: this.agentType,
      mode: this.mode as 'prompt' | 'interactive',
      cwd: this.cwd,
      gitBranch: this.gitBranch,
      repoName: this.repoName,
      timestamp: Date.now(),
    });
  }

  setClaudeSessionId(claudeSessionId: string): void {
    this._claudeSessionId = claudeSessionId;

    this._events.push({
      type: 'session:claude-id-detected',
      sessionId: this.id,
      claudeSessionId,
      timestamp: Date.now(),
    });
  }

  setResumable(resumable: boolean): void {
    if (this._resumable === resumable) return;
    this._resumable = resumable;

    this._events.push({
      type: 'session:resumable-changed',
      sessionId: this.id,
      resumable,
      timestamp: Date.now(),
    });
  }

  delete(): void {
    if (!this.canDelete) {
      throw new CannotDeleteActiveSessionError(this.id);
    }

    this._events.push({
      type: 'session:deleted',
      sessionId: this.id,
      timestamp: Date.now(),
    });
  }

  pullEvents(): SessionDomainEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  private transitionTo(to: SessionStatus): void {
    if (!canTransition(this._status, to)) {
      throw new InvalidStatusTransitionError(this._status, to);
    }
    this._status = to;
  }
}
