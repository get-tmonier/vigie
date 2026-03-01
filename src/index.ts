import { start } from './commands/start.js';
import { version } from './commands/version.js';

const command = process.argv[2];

switch (command) {
  case 'start':
    start();
    break;
  case 'version':
  case '--version':
  case '-v':
    version();
    break;
  default:
    console.log('Usage: tmonier <command>');
    console.log('');
    console.log('Commands:');
    console.log('  start      Start the tmonier daemon');
    console.log('  version    Show version');
    break;
}
