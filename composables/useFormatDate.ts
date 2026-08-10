export function useFormatDate() {
  function formatDate(date: string | Date) {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()

    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`

    const isToday = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()

    const isSameMonth = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()

    if (isToday) {
      if (diff < 60_000) return '刚刚'
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
      return `${Math.floor(diff / 3600_000)} 小时前`
    }

    if (isSameMonth) {
      const days = Math.floor(diff / 86400_000)
      if (days > 0) return `${days} 天前`
    }

    return dateStr
  }

  return { formatDate }
}
