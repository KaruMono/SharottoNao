import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '~/server/utils/prisma'
import { generateToken } from '~/server/utils/auth'
import { checkRegisterRateLimit, getClientIp } from '~/server/utils/rate-limit'
import { verifyCaptcha } from '~/server/utils/captcha'
import { resolveAvatar } from '~/server/utils/gravatar'
import { checkIpBlacklist } from '~/server/utils/ip-blacklist'
import { sendNotification } from '~/server/utils/notification'

const schema = z.object({
  username: z.string()
    .min(2, '用户名至少2个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文'),
  email: z.string().email('请输入有效的邮箱地址').transform(v => v.toLowerCase()),
  password: z.string()
    .min(8, '密码至少8个字符')
    .max(50, '密码最多50个字符')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字'),
  code: z.string().length(6, '验证码必须是6位'),
  captcha: z.string().min(1, '请输入图片验证码'),
})

export default defineEventHandler(async (event) => {
  // 注册频率限制
  await checkRegisterRateLimit(event)

  const body = await readBody(event)
  const { username, email, password, code, captcha } = schema.parse(body)

  // 校验图片验证码（最先验证，防止暴力破解）
  verifyCaptcha(event, captcha)

  // 检查 IP 黑名单
  await checkIpBlacklist(event)

  // 验证验证码
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      code,
      type: 'REGISTER',
      expiresAt: {
        gte: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!verificationCode) {
    throw createError({
      statusCode: 400,
      message: '验证码错误或已过期',
    })
  }

  // 检查用户名是否已存在
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  })
  if (existingUsername) {
    throw createError({
      statusCode: 400,
      message: '用户名已被使用',
    })
  }

  // 检查邮箱是否已存在
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  })
  if (existingEmail) {
    throw createError({
      statusCode: 400,
      message: '邮箱已被注册',
    })
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10)

  // 创建用户
  const registrationIp = getClientIp(event)
  let user
  try {
    user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        registrationIp,
      },
    })
  } catch (e: any) {
    // 并发注册时唯一约束冲突，转成与存在性检查一致的友好提示
    if (e?.code === 'P2002') {
      throw createError({
        statusCode: 400,
        message: e?.meta?.target?.includes('username') ? '用户名已被使用' : '邮箱已被注册',
      })
    }
    throw e
  }

  // 删除已使用的验证码
  await prisma.verificationCode.deleteMany({
    where: { email, type: 'REGISTER' },
  })

  // 发送欢迎通知中心消息（异步，不阻塞注册流程）
  sendNotification({
    receiverId: user.id,
    type: 'SYSTEM',
    title: '欢迎加入！关于内容过滤模式的说明',
    content: `你好 ${username}，欢迎注册！\n\n本站部分游戏资源标记为 NSFW（Not Safe For Work），默认情况下这些内容会被过滤隐藏。如需浏览全部内容，请点击页面右上角的设置图标，将内容过滤模式从「SFW」切换为「NSFW」或「全部」即可。\n\n祝你使用愉快！`,
  }).catch(() => {})

  // 生成token
  const token = generateToken(user)

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: await resolveAvatar(user.avatar, user.email),
      role: user.role,
      nsfwMode: user.nsfwMode,
    },
  }
})
