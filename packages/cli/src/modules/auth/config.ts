import { homedir } from 'node:os';
import { join } from 'node:path';

export const VIGIE_HOME = join(homedir(), '.vigie');
