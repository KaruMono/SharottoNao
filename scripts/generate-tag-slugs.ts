import { PrismaClient } from '@prisma/client'
import pinyinModule from 'pinyin'

const pinyin = pinyinModule

const prisma = new PrismaClient()

function generateSlug(text: string): string {
  const hasChinese = /[\u4e00-\u9fa5]/.test(text)
  
  if (hasChinese) {
    const pinyinResult = pinyin(text, {
      style: pinyin.STYLE_NORMAL,
      heteronym: false,
    })
    
    return pinyinResult
      .flat()
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  } else {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
}

async function main() {
  const tags = await prisma.tag.findMany({
    where: { slug: null },
  })

  console.log(`Found ${tags.length} tags without slug`)

  for (const tag of tags) {
    let baseSlug = generateSlug(tag.name) || 'tag'
    let slug = baseSlug
    let counter = 2

    // 检查重复
    while (true) {
      const existing = await prisma.tag.findFirst({
        where: { slug, id: { not: tag.id } },
      })
      if (!existing) break
      slug = `${baseSlug}-${counter}`
      counter++
    }

    await prisma.tag.update({
      where: { id: tag.id },
      data: { slug },
    })

    console.log(`Updated tag "${tag.name}" with slug "${slug}"`)
  }

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
