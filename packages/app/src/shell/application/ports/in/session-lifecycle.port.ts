export interface SessionLifecycleShape {
  markEnded(sessionId: string, exitCode: number): void;
  markError(sessionId: string, error: string): void;
  setAgentSessionId(sessionId: string, agentSessionId: string): void;
  deregister(sessionId: string): void;
}
