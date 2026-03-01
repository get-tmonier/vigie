/** @type {import('npm-check-updates').RunOptions} */
module.exports = {
  // Landing pins vite to 6.x for Astro 5 compatibility (Astro 5 uses vite 6 internally).
  // Remove this override when migrating to Astro 6 (which ships with vite 7).
  reject: ['vite', '@tmonier/*'],
};
