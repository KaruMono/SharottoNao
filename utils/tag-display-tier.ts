import type { GameDetailTag } from '~/types/api'

export type TagDisplayTier = 'PRIMARY' | 'SECONDARY'
export type GameTagSource = 'MANUAL' | 'VNDB' | 'SYSTEM'

export type GameTagDisplaySource = {
  source: GameTagSource
  displayTier?: TagDisplayTier
}

export type GameTagGroupKind = 'primary' | 'secondary' | 'nsfw'

export type GameTagGroup = {
  kind: GameTagGroupKind
  label: string
  tags: GameDetailTag[]
}

const GROUP_DEFINITIONS: Array<Omit<GameTagGroup, 'tags'>> = [
  { kind: 'primary', label: '标签' },
  { kind: 'secondary', label: '副标签' },
  { kind: 'nsfw', label: 'R18 标签' },
]

/**
 * Manual and system associations are authoritative primary labels. A tag is
 * secondary only when every recorded association is a secondary VNDB source.
 */
export function resolveGameTagDisplayTier(
  sources: readonly GameTagDisplaySource[] = [],
): TagDisplayTier {
  if (sources.length === 0) return 'PRIMARY'

  return sources.every(source => (
    source.source === 'VNDB' && source.displayTier === 'SECONDARY'
  ))
    ? 'SECONDARY'
    : 'PRIMARY'
}

/**
 * R18 is a content classification rather than an importance tier, so it
 * always wins over PRIMARY/SECONDARY when tags are presented to the user.
 */
export function groupGameDetailTags(tags: readonly GameDetailTag[] = []): GameTagGroup[] {
  const grouped: Record<GameTagGroupKind, GameDetailTag[]> = {
    primary: [],
    secondary: [],
    nsfw: [],
  }

  for (const tag of tags) {
    if (tag.isNsfw) {
      grouped.nsfw.push(tag)
    } else if (tag.displayTier === 'SECONDARY') {
      grouped.secondary.push(tag)
    } else {
      // Old API payloads and historical rows have no tier. Keeping them in
      // the primary group avoids silently demoting tags during deployment.
      grouped.primary.push(tag)
    }
  }

  return GROUP_DEFINITIONS
    .map(group => ({ ...group, tags: grouped[group.kind] }))
    .filter(group => group.tags.length > 0)
}
