/** @type {import('npm-check-updates').RunOptions} */
module.exports = {
  // Only suggest packages published at least 3 days ago
  cooldown: '3d',
  // Pin exact versions (no ^ or ~)
  target: 'latest',
  // Ignore workspace protocol references
  reject: ['@tmonier/*'],
  // Remove version range prefixes
  removeRange: true,
};
