import { homedir } from 'node:os';
import { join } from 'node:path';

export const VERSION = '0.3.0';
export const TMONIER_HOME = join(homedir(), '.tmonier');
export const PID_FILE = join(TMONIER_HOME, 'daemon.pid');
export const LOG_FILE = join(TMONIER_HOME, 'daemon.log');
export const SOCKET_PATH = join(TMONIER_HOME, 'daemon.sock');
export const STDIN_SOCKET_PATH = join(TMONIER_HOME, 'daemon-stdin.sock');
export const DB_FILE = join(TMONIER_HOME, 'data.db');
