import nodemailer from 'nodemailer'
import { getSiteName } from './settings'
import { recordSystemError, serializeSystemError } from './system-error-log'

let transporter: nodemailer.Transporter | null = null

export function resetTransporter() {
  transporter = null
}

function getTransporter() {
  if (transporter) return transporter

  const config = useRuntimeConfig()
  const port = parseInt(config.smtp.port as string)
  const secureOption = (config.smtp as any).secure || 'auto'
  const ignoreTlsErrors = (config.smtp as any).ignoreTlsErrors === true

  // secure 选项：auto=根据端口自动判断, true=强制SSL/TLS, false=不加密
  let secure: boolean
  if (secureOption === 'true' || secureOption === true) {
    secure = true
  } else if (secureOption === 'false' || secureOption === false) {
    secure = false
  } else {
    // auto: 465 用隐式 SSL/TLS，其他端口（如 587）用 STARTTLS
    secure = port === 465
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host as string,
    port,
    secure,
    auth: {
      user: config.smtp.user as string,
      pass: config.smtp.pass as string,
    },
    tls: {
      rejectUnauthorized: !ignoreTlsErrors,
    },
  })

  return transporter
}

/**
 * 构建发件人地址
 * 优先使用 SMTP_FROM_NAME，否则使用站点名称
 */
async function getFromAddress(): Promise<string> {
  const config = useRuntimeConfig()
  const fromEmail = config.smtp.from as string
  const fromName = (config.smtp as any).fromName as string
  
  if (fromName) {
    return `${fromName} <${fromEmail}>`
  }
  
  const siteName = await getSiteName()
  return `${siteName} <${fromEmail}>`
}

async function safeSendMail(mailOptions: nodemailer.SendMailOptions) {
  const transport = getTransporter()
  try {
    await transport.sendMail(mailOptions)
  } catch (err: any) {
    // 连接级错误（证书过期、连接拒绝等）清除缓存，下次重建 transporter
    if (err?.code === 'ESOCKET' || err?.code === 'ECONNECTION') {
      resetTransporter()
    }
    const serialized = serializeSystemError(err)
    await recordSystemError({
      type: 'MAIL',
      source: 'safeSendMail',
      message: serialized.message || '邮件发送失败',
      detail: serialized.detail,
      metadata: {
        code: err?.code,
        command: err?.command,
        responseCode: err?.responseCode,
        to: mailOptions.to,
        subject: mailOptions.subject,
      },
    })
    throw err
  }
}

export async function sendVerificationEmail(email: string, code: string) {
  const name = await getSiteName()
  const from = await getFromAddress()

  await safeSendMail({
    from,
    to: email,
    subject: `【${name}】邮箱验证码`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
        <h2 style="color: #1f2937;">${name} - 邮箱验证</h2>
        <p>您好，</p>
        <p>您的验证码是：</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
        </div>
        <p>验证码有效期为 15 分钟。</p>
        <p>如果这不是您的操作，请忽略此邮件。</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, code: string) {
  const name = await getSiteName()
  const from = await getFromAddress()

  await safeSendMail({
    from,
    to: email,
    subject: `【${name}】密码重置验证码`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
        <h2 style="color: #1f2937;">${name} - 密码重置</h2>
        <p>您好，</p>
        <p>您正在重置密码，验证码是：</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
        </div>
        <p>验证码有效期为 15 分钟。</p>
        <p>如果这不是您的操作，请立即检查您的账户安全。</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
      </div>
    `,
  })
}

const typeLabels: Record<string, { label: string; color: string }> = {
  COMMENT_REPLY: { label: '评论回复', color: '#3b82f6' },
  COMMENT_LIKE: { label: '评论点赞', color: '#ef4444' },
  MENTION: { label: '@提及', color: '#8b5cf6' },
  RESOURCE_APPROVED: { label: '资源审核通过', color: '#16a34a' },
  RESOURCE_REJECTED: { label: '资源审核驳回', color: '#dc2626' },
  RESOURCE_HEALTH: { label: '资源可用性', color: '#f97316' },
  EDIT_APPROVED: { label: '编辑请求通过', color: '#16a34a' },
  EDIT_REJECTED: { label: '编辑请求驳回', color: '#dc2626' },
  FOLLOWING_ACTIVITY: { label: '关注动态', color: '#06b6d4' },
  FAVORITE_GAME_UPDATE: { label: '收藏条目更新', color: '#22c55e' },
  SYSTEM: { label: '系统通知', color: '#6b7280' },
  OTHER: { label: '其他通知', color: '#6b7280' },
}

export async function sendNotificationEmail(
  email: string,
  type: string,
  title: string,
  content: string,
  relatedUrl?: string,
) {
  const config = useRuntimeConfig()
  const { label, color } = typeLabels[type] || typeLabels.OTHER
  const siteUrl = ((config.public?.siteUrl as string) || '').replace(/\/+$/, '')
  const fullUrl = relatedUrl ? `${siteUrl}${relatedUrl}` : ''
  const name = await getSiteName()
  const from = await getFromAddress()

  await safeSendMail({
    from,
    to: email,
    subject: `【${name}】${label} - ${title}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
        <h2 style="color: #1f2937;">${name} - 消息通知</h2>
        <div style="display: inline-block; padding: 4px 12px; border-radius: 4px; background: ${color}; color: #fff; font-size: 13px; margin-bottom: 16px;">
          ${label}
        </div>
        <h3 style="color: #1f2937; margin: 12px 0 8px;">${title}</h3>
        <p style="color: #4b5563; line-height: 1.6;">${content}</p>
        ${fullUrl ? `<a href="${fullUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #1f2937; color: #fff; text-decoration: none; border-radius: 6px;">查看详情</a>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px;">如不想收到此类邮件，请在个人中心关闭对应通知类型。</p>
      </div>
    `,
  })
}
