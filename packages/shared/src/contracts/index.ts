import { initContract } from '@ts-rest/core';

const c = initContract();

export const healthContract = c.router({
  getHealth: {
    method: 'GET',
    path: '/health',
    responses: {
      200: c.type<{ status: string }>(),
    },
    summary: 'Health check',
  },
});
