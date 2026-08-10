export default defineEventHandler(async () => {
  // JWT无状态，客户端删除token即可
  return { success: true }
})
