/**
 * Hostinger LiteSpeed entry — MUST be CommonJS (.cjs).
 * lsnode.js loads the startup file via require(); ESM ("type":"module") crashes with
 * ERR_REQUIRE_ASYNC_MODULE.
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

async function boot() {
  // Prefer ESM loader so server/ ("type":"module") TS sources resolve correctly.
  const { register } = await import('tsx/esm/api')
  register()
  console.log('[febracis] tsx registered, loading server/src/index.ts')
  await import('./server/src/index.ts')
}

boot().catch((err) => {
  console.error('[febracis] FATAL boot failure', err)
  setTimeout(() => process.exit(1), 2000)
})
