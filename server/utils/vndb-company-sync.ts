import type { Prisma } from '@prisma/client'

export interface VndbDeveloperInput {
  name: string
  nameOriginal: string | null
}

export interface VndbCompanySyncResult {
  developersFound: number
  companiesMatched: number
  companiesCreated: number
  companiesLinked: number
  matchedNames: string[]
  createdNames: string[]
}

type VndbCompanySyncClient = Pick<
  Prisma.TransactionClient,
  'company' | 'gameCompany'
>

export function normalizeCompanyName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US')
}

export function getCompanyNameIndex(name: string): string {
  const firstChar = name.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(firstChar) ? firstChar : '#'
}

function developerNames(developer: VndbDeveloperInput): string[] {
  return [...new Set([developer.name, developer.nameOriginal]
    .filter((name): name is string => Boolean(name?.trim()))
    .map(name => normalizeCompanyName(name)))]
}

export async function syncVndbDevelopersForGame(
  client: VndbCompanySyncClient,
  input: {
    gameId: number
    creatorId: number
    developers: VndbDeveloperInput[]
  },
): Promise<VndbCompanySyncResult> {
  const developers = input.developers.filter(developer => developer.name?.trim())
  const companies = await client.company.findMany({
    select: { id: true, name: true, nameOriginal: true, aliases: true },
  })

  const companyByName = new Map<string, (typeof companies)[number]>()
  for (const company of companies) {
    for (const name of [company.name, company.nameOriginal, ...company.aliases]) {
      if (!name?.trim()) continue
      const normalized = normalizeCompanyName(name)
      if (!companyByName.has(normalized)) companyByName.set(normalized, company)
    }
  }

  let companiesMatched = 0
  let companiesCreated = 0
  let companiesLinked = 0
  const matchedNames: string[] = []
  const createdNames: string[] = []
  const linkedCompanyIds = new Set<number>()

  for (const developer of developers) {
    const names = developerNames(developer)
    let company = names.map(name => companyByName.get(name)).find(Boolean)

    if (company) {
      companiesMatched++
      matchedNames.push(`${developer.name} → ${company.name}`)
    } else {
      const name = developer.name.trim()
      const nameOriginal = developer.nameOriginal?.trim() || null
      company = await client.company.create({
        data: {
          name,
          nameOriginal,
          nameIndex: getCompanyNameIndex(name),
          aliases: [],
          creatorId: input.creatorId,
        },
        select: { id: true, name: true, nameOriginal: true, aliases: true },
      })
      companiesCreated++
      createdNames.push(company.name)

      for (const companyName of [company.name, company.nameOriginal]) {
        if (companyName?.trim()) companyByName.set(normalizeCompanyName(companyName), company)
      }
    }

    if (linkedCompanyIds.has(company.id)) continue
    await client.gameCompany.upsert({
      where: {
        gameId_companyId: {
          gameId: input.gameId,
          companyId: company.id,
        },
      },
      update: { role: 'DEVELOPER' },
      create: {
        gameId: input.gameId,
        companyId: company.id,
        role: 'DEVELOPER',
      },
    })
    linkedCompanyIds.add(company.id)
    companiesLinked++
  }

  return {
    developersFound: developers.length,
    companiesMatched,
    companiesCreated,
    companiesLinked,
    matchedNames,
    createdNames,
  }
}
