import { isAbsolute, resolve, sep } from 'node:path'

/**
 * Resolve the local upload directory once at the request boundary.
 *
 * Production releases may run with a different cwd on every deployment, so a
 * relative path is resolved against that release while an absolute path can
 * point at a shared directory outside the release tree.
 */
export function resolveUploadRoot(config = useRuntimeConfig()): string {
  const configured = String(config.localUploadPath || './uploads')
  return isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured)
}

/**
 * Resolve a user/database supplied relative upload path and reject traversal.
 */
export function resolveUploadFile(relativePath: string, config = useRuntimeConfig()): string | null {
  const root = resolveUploadRoot(config)
  const candidate = resolve(root, relativePath)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null
  return candidate
}
