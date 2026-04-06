export interface AgentConfig {
  readonly name: string;
  readonly command: string;
  readonly buildArgs: (opts?: {
    sessionId?: string;
    resume?: boolean;
    claudeSessionId?: string;
  }) => string[];
  readonly resumable: boolean;
  readonly detectSessionId?: boolean;
}

const BUILTIN_AGENTS: Record<string, AgentConfig> = {
  claude: {
    name: 'claude',
    command: 'claude',
    buildArgs: (opts) => {
      const args: string[] = ['claude'];
      if (opts?.claudeSessionId) {
        if (opts.resume) {
          args.push('--resume', opts.claudeSessionId);
        } else {
          args.push('--session-id', opts.claudeSessionId);
        }
      }
      return args;
    },
    resumable: true,
    detectSessionId: true,
  },
  aider: {
    name: 'aider',
    command: 'aider',
    buildArgs: () => ['aider'],
    resumable: false,
  },
  codex: {
    name: 'codex',
    command: 'codex',
    buildArgs: () => ['codex'],
    resumable: false,
  },
  generic: {
    name: 'generic',
    command: 'sh',
    buildArgs: () => ['sh'],
    resumable: false,
  },
};

export function resolveAgent(agentType: string): AgentConfig {
  const config = BUILTIN_AGENTS[agentType];
  if (config) return config;

  // Treat unknown agent types as generic commands
  return {
    name: agentType,
    command: agentType,
    buildArgs: () => [agentType],
    resumable: false,
  };
}
