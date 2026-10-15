import prisma from '../server/utils/prisma'
import { reconcileVndbTagSourcesInTransaction } from '../server/utils/vndb-tag-sync'

try {
  await prisma.$transaction(async (tx) => {
    await reconcileVndbTagSourcesInTransaction(tx, { gameIds: [6] })
    throw new Error('__ROLLBACK__')
  })
} catch (error) {
  if (!(error instanceof Error) || error.message !== '__ROLLBACK__') throw error
} finally {
  await prisma.$disconnect()
}

console.log('reconcile-sql-ok (rolled back)')
