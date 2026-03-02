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
});
