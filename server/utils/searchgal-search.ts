import { Prisma, type Game } from '@prisma/client'

export type SearchgalGameRow = Pick<Game, 'id' | 'titleZhHans' | 'titleZhHant' | 'titleJa' | 'titleEn' | 'isNsfw'>

/** All filtering, relevance ranking, deduplication and limiting happen in PostgreSQL. */
export function buildSearchgalSearchQuery(q: string, limit: number, includeNsfw: boolean): Prisma.Sql {
  const literal = q.replace(/[\\%_]/g, '\\$&')
  const prefix = `${literal}%`
  const contains = `%${literal}%`
  const eligibleResource = Prisma.sql`
    r."gameId" = g.id AND r."deletedAt" IS NULL
    AND r.status = 'APPROVED' AND r."healthStatus" <> 'UNAVAILABLE'
  `

  return Prisma.sql`
    SELECT g.id, g."titleZhHans", g."titleZhHant", g."titleJa", g."titleEn", g."isNsfw"
    FROM "Game" g
    CROSS JOIN LATERAL (
      SELECT MIN(CASE
        WHEN title ILIKE ${literal} ESCAPE chr(92) THEN 1
        WHEN title ILIKE ${prefix} ESCAPE chr(92) THEN 2
        ELSE 3
      END) AS rank
      FROM unnest(ARRAY[g."titleZhHans", g."titleZhHant", g."titleJa", g."titleEn"] || g.aliases) AS titles(title)
      WHERE title ILIKE ${contains} ESCAPE chr(92)
    ) matches
    WHERE g."deletedAt" IS NULL
      AND (${includeNsfw}::boolean OR g."isNsfw" = false)
      AND EXISTS (SELECT 1 FROM "Resource" r WHERE ${eligibleResource})
      AND (
        matches.rank IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM "Resource" r
          WHERE ${eligibleResource} AND r.title ILIKE ${contains} ESCAPE chr(92)
        )
      )
    ORDER BY COALESCE(matches.rank, 4), g."viewCount" DESC, g.id ASC
    LIMIT ${limit}
  `
}
