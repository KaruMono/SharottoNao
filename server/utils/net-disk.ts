import prisma from '~/server/utils/prisma'

function normalizeHostname(value: string): string | null {
  try {
    const url = new URL(value)
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalized = normalizeDomain(domain)
  return hostname === normalized || hostname.endsWith(`.${normalized}`)
}

type NetDiskMatcher = {
  id: number
  domains: string[]
}

function matchNetDiskTypeId(url: string, types: NetDiskMatcher[]): number | null {
  const hostname = normalizeHostname(url)
  if (!hostname) return null

  const matched = types.find(type => type.domains.some(domain => matchesDomain(hostname, domain)))
  return matched?.id ?? null
}

export async function detectNetDiskTypeId(url: string): Promise<number | null> {
  const types = await prisma.netDiskType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  return matchNetDiskTypeId(url, types)
}

export async function refreshResourceNetDiskTypes(): Promise<{ scanned: number; updated: number }> {
  const types = await prisma.netDiskType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, domains: true },
  })

  const resources = await prisma.resource.findMany({
    where: { deletedAt: null },
    select: { id: true, url: true, netDiskTypeId: true },
  })

  let updated = 0
  for (const resource of resources) {
    const netDiskTypeId = matchNetDiskTypeId(resource.url, types)
    if (netDiskTypeId !== resource.netDiskTypeId) {
      await prisma.resource.update({
        where: { id: resource.id },
        data: { netDiskTypeId },
      })
      updated += 1
    }
  }

  return { scanned: resources.length, updated }
}
