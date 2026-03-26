import { homedir } from 'node:os';
import { join } from 'node:path';

export const VERSION = '0.3.0';
export const VIGIE_HOME = join(homedir(), '.vigie');
export const PID_FILE = join(VIGIE_HOME, 'daemon.pid');
export const LOG_FILE = join(VIGIE_HOME, 'daemon.log');
export const SOCKET_PATH = join(VIGIE_HOME, 'daemon.sock');
export const STDIN_SOCKET_PATH = join(VIGIE_HOME, 'daemon-stdin.sock');
export const DB_FILE = join(VIGIE_HOME, 'data.db');
