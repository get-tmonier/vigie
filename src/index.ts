import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { start } from './commands/start.js';
import { version } from './commands/version.js';

const command = process.argv[2];

switch (command) {
  case 'start':
    await start();
    break;
  case 'login':
    await login();
    break;
  case 'logout':
    await logout();
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
    console.log('  login      Save your API key');
    console.log('  logout     Clear saved credentials');
    console.log('  version    Show version');
    break;
}
