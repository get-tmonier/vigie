import { initContract } from '@ts-rest/core';

const c = initContract();

export const daemonContract = c.router({
  listDaemons: {
    method: 'GET',
    path: '/daemons',
    responses: {
      200: c.type<{
        daemons: Array<{
          id: string;
          hostname: string;
          pid: number;
          version: string;
          connectedAt: number;
        }>;
      }>(),
    },
    summary: 'List connected daemons',
  },
  executeCommand: {
    method: 'POST',
    path: '/daemons/:daemonId/exec',
    body: c.type<{ command: string; cwd?: string }>(),
    responses: {
      200: c.type<{ commandId: string }>(),
      404: c.type<{ error: string }>(),
    },
    summary: 'Execute a command on a daemon',
  },
  listSessions: {
    method: 'GET',
    path: '/daemons/:daemonId/sessions',
    responses: {
      200: c.type<{
        sessions: Array<{
          id: string;
          daemonId: string;
          agentType: 'claude' | 'opencode' | 'generic';
          mode: 'prompt' | 'interactive';
          cwd: string;
          gitBranch?: string;
          repoName?: string;
          startedAt: number;
          status: 'active' | 'ended';
        }>;
      }>(),
      404: c.type<{ error: string }>(),
    },
    summary: 'List sessions for a daemon',
  },
});
