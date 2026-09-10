import { randomBytes, randomUUID } from 'node:crypto'

export function id(prefix?: string) {
  const value = randomUUID()
  return prefix ? `${prefix}-${value}` : value
}

export function sessionToken() {
  return randomBytes(32).toString('hex')
}

export function nowIso() {
  return new Date().toISOString()
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
