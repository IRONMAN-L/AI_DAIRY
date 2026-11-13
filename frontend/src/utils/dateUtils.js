export function getToday() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getNextDate(value) {
  const base = value ? new Date(`${value}T12:00:00`) : new Date()
  base.setDate(base.getDate() + 1)

  return [
    base.getFullYear(),
    String(base.getMonth() + 1).padStart(2, '0'),
    String(base.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getPreviousDate(value) {
  const base = value ? new Date(`${value}T12:00:00`) : new Date()
  base.setDate(base.getDate() - 1)

  return [
    base.getFullYear(),
    String(base.getMonth() + 1).padStart(2, '0'),
    String(base.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getStartOfWeek(dateStr) {
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date()
  const day = d.getDay() // 0 is Sunday, 1 is Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d.setDate(diff))
  return [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-')
}

export function formatDisplayDate(dateStr, locale = 'en-IN') {
  if (!dateStr) return ''
  const parsed = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateStr

  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isValidDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const parsed = new Date(`${dateStr}T12:00:00`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === dateStr
  )
}

export function isDateAfter(laterDate, earlierDate) {
  return laterDate > earlierDate
}
