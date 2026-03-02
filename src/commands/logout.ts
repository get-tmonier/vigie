import { clearCredentials } from '../credentials.js';

export async function logout() {
  await clearCredentials();
  console.log('Credentials cleared.');
}
