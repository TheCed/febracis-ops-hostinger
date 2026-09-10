/**
 * Hostinger entry file (must be .js / .mjs / .cjs).
 * Loads TypeScript via tsx, then boots Express.
 */
import { register } from 'tsx/esm/api'

register()
await import('./server/src/index.ts')
