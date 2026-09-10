/**
 * Hostinger LiteSpeed entry — MUST be CommonJS (.cjs).
 * Loads a pre-bundled server (no tsx/esbuild spawn at runtime).
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
  require('./server.bundle.cjs')
} catch (err) {
  console.error('[febracis] FATAL boot failure', err)
  setTimeout(() => process.exit(1), 2000)
}
