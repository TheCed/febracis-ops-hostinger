/**
 * Hostinger entry file (must be .js).
 * Boots Express TypeScript via tsx. Logs loudly so Runtime Logs show crashes.
 */
console.log('[febracis] boot', {
  node: process.version,
  port: process.env.PORT || '(unset)',
  cwd: process.cwd(),
  nodeEnv: process.env.NODE_ENV || '(unset)',
})

process.on('uncaughtException', (err) => {
  console.error('[febracis] uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[febracis] unhandledRejection', err)
})

try {
  const { register } = await import('tsx/esm/api')
  register()
  console.log('[febracis] tsx registered, loading server/src/index.ts')
  await import('./server/src/index.ts')
} catch (err) {
  console.error('[febracis] FATAL boot failure', err)
  // Keep process alive briefly so Hostinger captures the log, then exit.
  setTimeout(() => process.exit(1), 2000)
}
