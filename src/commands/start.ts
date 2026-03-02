import * as v from 'valibot';
import { config } from '../config.js';
import { getCredentials } from '../credentials.js';
import { executeCommand } from '../execution/executor.js';
import { DownstreamMessageSchema } from '../schemas/messages.js';
import { connectWebSocket } from '../ws/client.js';

export async function start() {
  console.log('tmonier daemon starting...');

  const token = config.TMONIER_TOKEN ?? (await getCredentials())?.token;

  if (!token) {
    console.error('No API key found. Run `tmonier login` first.');
    process.exit(1);
  }

  connectWebSocket(config.TMONIER_API_URL, token, (data, send) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    const result = v.safeParse(DownstreamMessageSchema, parsed);
    if (!result.success) return;

    const msg = result.output;

    switch (msg.type) {
      case 'command:request': {
        executeCommand(msg, send);
        break;
      }
      case 'ping': {
        send({ type: 'pong' });
        break;
      }
    }
  });

  // Keep process alive
  setInterval(() => {}, 1 << 30);
}
