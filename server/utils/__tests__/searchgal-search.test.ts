import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildSearchgalSearchQuery, type SearchgalGameRow } from '../searchgal-search'

// Execute the production parameterized SQL in PostgreSQL (WASM), without a live database.
const db = new PGlite()
beforeAll(async () => {
  await db.exec(`
    CREATE TYPE "ResourceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    CREATE TYPE "ResourceHealthStatus" AS ENUM ('AVAILABLE', 'NEEDS_REVIEW', 'SUSPECTED_BAD', 'UNAVAILABLE');
    CREATE TABLE "Game" (
      id integer PRIMARY KEY, "titleZhHans" varchar(255), "titleZhHant" varchar(255),
      "titleJa" varchar(255), "titleEn" varchar(255), aliases text[] NOT NULL DEFAULT '{}',
      "isNsfw" boolean NOT NULL DEFAULT false, "viewCount" integer NOT NULL DEFAULT 0,
      "deletedAt" timestamp
    );
    CREATE TABLE "Resource" (
      id serial PRIMARY KEY, "gameId" integer NOT NULL REFERENCES "Game"(id), title varchar(255) NOT NULL,
      status "ResourceStatus" NOT NULL DEFAULT 'APPROVED',
      "healthStatus" "ResourceHealthStatus" NOT NULL DEFAULT 'AVAILABLE', "deletedAt" timestamp
    );
  `)
}, 30000)
beforeEach(() => db.exec('TRUNCATE "Resource", "Game" RESTART IDENTITY'))
afterAll(() => db.close())

async function game(id: number, fields: Record<string, unknown> = {}, withResource = true) {
  const data = { id, titleEn: `Game ${id}`, ...fields }
  const keys = Object.keys(data)
  await db.query(`INSERT INTO "Game" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(data))
  if (withResource) await resource(id)
}

async function resource(gameId: number, fields: Record<string, unknown> = {}) {
  const data = { gameId, title: 'Download', ...fields }
  const keys = Object.keys(data)
  await db.query(`INSERT INTO "Resource" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(data))
}

async function search(q: string, limit = 12, nsfw = false) {
  const query = buildSearchgalSearchQuery(q, limit, nsfw)
  return (await db.query<SearchgalGameRow>(query.text, query.values)).rows
}
async function ids(q: string, limit = 12, nsfw = false) {
  return (await search(q, limit, nsfw)).map(row => row.id)
}

describe('SearchGal PostgreSQL search', () => {
  it.each([
    ['titleZhHans', '千恋＊万花', '千恋'],
    ['titleZhHant', '千戀＊萬花', '萬花'],
    ['titleJa', 'サノバウィッチ', 'ウィッチ'],
    ['titleEn', 'Summer Pockets', 'sUmMeR'],
    ['aliases', ['Alias Name', '千恋万花'], 'ALIAS'],
  ])('searches %s by case-insensitive substring', async (field, value, q) => {
    await game(1, { [field]: value })
    expect(await ids(q)).toEqual([1])
  })

  it('matches each alias separately, without matching across array boundaries', async () => {
    await game(1, { aliases: ['Alpha', 'Beta'] })
    expect(await ids('ha||Be')).toEqual([])
    expect(await ids('haBe')).toEqual([])
    expect(await ids('BETA')).toEqual([1])
  })

  it('deduplicates games matching multiple titles, aliases and resources', async () => {
    await game(1, { titleEn: 'Needle', titleJa: 'needle', aliases: ['Needle', 'NEEDLE'] })
    await resource(1, { title: 'Needle patch' })
    await resource(1, { title: 'Needle translation' })
    await game(2)
    await resource(2, { title: 'needle resource only' })
    expect(await ids('needle')).toEqual([1, 2])
  })

  it('ranks exact > prefix > substring > resource, then views descending and ID ascending', async () => {
    await game(40, { titleEn: 'x needle x', viewCount: 10000 })
    await game(50, { viewCount: 100000 })
    await resource(50, { title: 'needle' })
    await game(30, { titleJa: 'Needle story', viewCount: 20 })
    await game(31, { aliases: ['needle alias'], viewCount: 20 })
    await game(20, { titleEn: 'NEEDLE', viewCount: 1 })
    await game(21, { aliases: ['Needle'], viewCount: 2 })
    expect(await ids('needle')).toEqual([21, 20, 30, 31, 40, 50])
    expect(await ids('needle', 3)).toEqual([21, 20, 30])
  })

  it('filters ineligible games/resources before limit, even when they rank higher', async () => {
    for (let id = 1; id <= 25; id++) {
      await game(id, { titleEn: 'needle', viewCount: 999 }, false)
      if (id % 4 === 0) await resource(id, { status: 'PENDING' })
      if (id % 4 === 1) await resource(id, { status: 'REJECTED' })
      if (id % 4 === 2) await resource(id, { deletedAt: new Date() })
      if (id % 4 === 3) await resource(id, { healthStatus: 'UNAVAILABLE' })
    }
    await game(26, { titleEn: 'needle', deletedAt: new Date() })
    await game(27, { titleEn: 'needle' }, false)
    await game(28, { titleEn: 'needle', isNsfw: true })
    await game(30, { titleEn: 'needle valid' })
    await game(31, { titleEn: 'needle valid too' })
    expect(await ids('needle', 2)).toEqual([30, 31])
  })

  it.each([
    { status: 'PENDING' }, { status: 'REJECTED' },
    { deletedAt: new Date() }, { healthStatus: 'UNAVAILABLE' },
  ])('never matches an ineligible resource title even if another resource is eligible: %j', async fields => {
    await game(1)
    await resource(1, { title: 'Hidden needle', ...fields })
    expect(await ids('needle')).toEqual([])
  })

  it.each(['NEEDS_REVIEW', 'SUSPECTED_BAD'])('retains approved resources with health %s', async healthStatus => {
    await game(1, {}, false)
    await resource(1, { title: 'needle', healthStatus })
    expect(await ids('needle')).toEqual([1])
  })

  it('uses only the server NSFW scope', async () => {
    await game(1, { titleEn: 'needle', isNsfw: true })
    await game(2, { titleEn: 'needle' })
    expect(await ids('needle')).toEqual([2])
    expect(await ids('needle', 12, true)).toEqual([1, 2])
  })

  it.each(['%', '_', '\\', "' OR 1=1 --", '100%_\\quote\''])('treats %s as a literal for titles, aliases and resource names', async q => {
    await game(1, { titleEn: q })
    await game(2, { aliases: [`${q} prefix`] })
    await game(3, { titleJa: `before ${q} after` })
    await game(4)
    await resource(4, { title: q })
    await game(5, { titleEn: 'unrelated', viewCount: 9999 })
    expect(await ids(q)).toEqual([1, 2, 3, 4])
    const query = buildSearchgalSearchQuery(q, 12, false)
    expect(query.text).not.toContain(q)
  })

  it('returns an empty result and selects only summary inputs', async () => {
    expect(await search('missing')).toEqual([])
    await game(1, { titleEn: 'needle' })
    expect(Object.keys((await search('needle'))[0]).sort()).toEqual([
      'id', 'isNsfw', 'titleEn', 'titleJa', 'titleZhHans', 'titleZhHant',
    ])
  })
})
