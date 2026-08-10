import { PrismaClient } from '@prisma/client'

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as PrismaGlobal

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

// 挂载到 globalThis 防止 dev 热重载创建多个实例，同时让 nitro close hook 能断开连接
globalForPrisma.prisma = prisma

export default prisma
