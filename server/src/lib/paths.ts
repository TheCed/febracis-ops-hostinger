import fs from 'node:fs'
import path from 'node:path'

/** App root: folder with package.json + server/ + web/ (Hostinger cwd). */
export function appRoot(): string {
  const cwd = process.cwd()
  if (
    fs.existsSync(path.join(cwd, 'server', 'package.json')) ||
    fs.existsSync(path.join(cwd, 'web', 'dist'))
  ) {
    return cwd
  }
  // Running with cwd = server/
  if (fs.existsSync(path.join(cwd, 'src')) && fs.existsSync(path.join(cwd, 'package.json'))) {
    return path.resolve(cwd, '..')
  }
  return cwd
}

export function dataDir(): string {
  return path.join(appRoot(), 'server', 'data')
}

export function webDistDir(): string {
  return path.join(appRoot(), 'web', 'dist')
}

export function envFileCandidates(): string[] {
  const root = appRoot()
  return [
    path.join(root, 'app.env'),
    path.join(root, '.env'),
    path.join(root, 'server', '.env'),
  ]
}
