/**
 * Hostinger entry file (must be .js / .mjs / .cjs).
 * Boots Express via tsx (TypeScript).
 */
import { register } from 'tsx/esm/api'

register()
await import('./server/src/index.ts')
