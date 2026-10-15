import { defineNuxtModule } from '@nuxt/kit'

const IGNORED_DIRECTORIES = [
  '.claude',
  '.cursor',
  '.kiro',
  '.git',
  '.nuxt',
  '.output',
  'dist',
  'node_modules',
  'uploads',
] as const

const IGNORED_DIRECTORY_PATTERNS = IGNORED_DIRECTORIES.flatMap(directory => [
  directory,
  `${directory}/**`,
  `**/${directory}`,
  `**/${directory}/**`,
])

type IgnoreMatcher = string | RegExp | ((path: string) => boolean)
type WatchOptionsLike = { ignored?: unknown }
type FileSystemStorageOptions = {
  driver?: string
  ignore?: unknown
}

const ignoredDirectoryNames = new Set<string>(IGNORED_DIRECTORIES)

function isIgnoredDirectoryPath(path: string) {
  return path.split(/[\\/]+/).some(segment => ignoredDirectoryNames.has(segment))
}

function mergeIgnored(current: unknown, additions: readonly IgnoreMatcher[]) {
  const merged: unknown[] = current == null
    ? []
    : Array.isArray(current)
      ? [...current]
      : [current]

  for (const addition of additions) {
    if (!merged.includes(addition)) {
      merged.push(addition)
    }
  }

  return merged
}

function mergeStorageIgnores(storageConfig: unknown, additions: readonly string[]) {
  if (!storageConfig || typeof storageConfig !== 'object') return

  for (const storage of Object.values(storageConfig)) {
    if (!storage || typeof storage !== 'object') continue

    const options = storage as FileSystemStorageOptions
    if (options.driver !== 'fs') continue

    options.ignore = mergeIgnored(options.ignore, additions)
  }
}

/**
 * Prevent development watchers from traversing generated, dependency,
 * uploaded, and local tool-state directories in the repository.
 */
export default defineNuxtModule({
  meta: {
    name: 'ignore-uploads',
  },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return

    const watcherIgnoreMatchers: IgnoreMatcher[] = [isIgnoredDirectoryPath]

    // Nitro can receive a string, matcher function, or an array from user config.
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.watchOptions ||= {}
      const watchOptions = nitroConfig.watchOptions as WatchOptionsLike
      watchOptions.ignored = mergeIgnored(watchOptions.ignored, watcherIgnoreMatchers)

      // Nuxt Content watches every Nitro storage mount in development. Its
      // filesystem drivers have independent watcher options, including the
      // root mount, so they need the same traversal guard.
      // Functions in Nitro storage config are serialized as null in the dev
      // worker bundle. Glob strings survive serialization and are compiled by
      // unstorage's filesystem driver at runtime.
      mergeStorageIgnores(nitroConfig.storage, IGNORED_DIRECTORY_PATTERNS)
      mergeStorageIgnores(nitroConfig.devStorage, IGNORED_DIRECTORY_PATTERNS)
    })

    // Vite uses the same matcher shapes as Chokidar. Preserve a null watch
    // option because it explicitly disables watching.
    nuxt.hook('vite:extendConfig', (viteConfig) => {
      const config = viteConfig as {
        server?: {
          watch?: WatchOptionsLike | null
        }
      }

      config.server ||= {}
      if (config.server.watch === null) return

      config.server.watch ||= {}
      config.server.watch.ignored = mergeIgnored(
        config.server.watch.ignored,
        watcherIgnoreMatchers,
      )
    })

    // Nuxt feeds this list to both its Chokidar ignore matcher and the Parcel
    // watcher. Include the directory itself so traversal stops at its root.
    nuxt.options.ignore = [
      ...new Set([
        ...(nuxt.options.ignore || []),
        ...IGNORED_DIRECTORY_PATTERNS,
      ]),
    ]

  },
})
