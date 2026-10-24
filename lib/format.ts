const nairaFmt = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })

export function naira(amount: number) {
  const sign = amount < 0 ? '−' : ''
  return `${sign}₦${nairaFmt.format(Math.abs(Math.round(amount)))}`
}

export function nairaCompact(amount: number) {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M`
  if (abs >= 1_000) return `₦${Math.round(amount / 1_000)}K`
  return naira(amount)
}

export const pct = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`
