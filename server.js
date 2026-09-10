/**
 * Legacy ESM entry — Hostinger lsnode cannot require() this file.
 * Use server.cjs as Application startup file.
 */
console.warn('[febracis] server.js is ESM; Hostinger needs server.cjs')
await import('./server.cjs')
