// Number parsing + display. Everything here is pure and unit-tested.
//
// Entry convention: a bare number in a money field means MILLIONS, because
// that is how venture numbers get spoken out loud ("a four hundred million
// fund", "a four million check"). Explicit suffixes always win: 500k, 1.4b.

const SUFFIX = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }

/** Parse a money string. Bare numbers are treated as millions. */
export function parseMoney(input) {
  if (typeof input === 'number') return input
  if (input == null) return NaN
  const s = String(input).trim().toLowerCase().replace(/[$,\s]/g, '')
  if (s === '' || s === '-' || s === '.') return NaN
  const m = s.match(/^(-?\d*\.?\d+)([kmbt])?$/)
  if (!m) return NaN
  const n = parseFloat(m[1])
  if (!isFinite(n)) return NaN
  return m[2] ? n * SUFFIX[m[2]] : n * 1e6
}

/** Parse a plain number (years, counts, multiples). No implied scaling. */
export function parseNum(input) {
  if (typeof input === 'number') return input
  if (input == null) return NaN
  const s = String(input).trim().toLowerCase().replace(/[x,\s]/g, '')
  if (s === '' || s === '-' || s === '.') return NaN
  const n = parseFloat(s)
  return isFinite(n) ? n : NaN
}

/**
 * Parse a percent into a fraction. "8" and "8%" both mean 0.08 — a bare
 * number is always read as percent, never as an already-divided fraction,
 * so that typing "20" never silently means 2000%.
 */
export function parsePct(input) {
  if (typeof input === 'number') return input
  if (input == null) return NaN
  const s = String(input).trim().replace(/[%,\s]/g, '')
  if (s === '' || s === '-' || s === '.') return NaN
  const n = parseFloat(s)
  return isFinite(n) ? n / 100 : NaN
}

// Trim one trailing zero so we get $5.0B and 4.22x rather than $5.00B,
// while keeping the last decimal place ($68.0M never becomes $68.).
function trim(str) {
  const dot = str.indexOf('.')
  if (dot < 0) return str
  return str.endsWith('0') && str.length - dot > 2 ? str.slice(0, -1) : str
}

function scaled(n) {
  const a = Math.abs(n)
  if (a >= 1e12) return [n / 1e12, 'T']
  if (a >= 1e9) return [n / 1e9, 'B']
  if (a >= 1e6) return [n / 1e6, 'M']
  if (a >= 1e3) return [n / 1e3, 'K']
  return [n, '']
}

function dp(v) {
  const a = Math.abs(v)
  return a >= 100 ? 0 : a >= 10 ? 1 : 2
}

function withUnit(n, prefix) {
  const neg = n < 0
  const [v, unit] = scaled(Math.abs(n))
  return `${neg ? '−' : ''}${prefix}${trim(v.toFixed(dp(v)))}${unit}`
}

/** $412K, $68.0M, $1.4B — 3 significant figures, sign preserved. */
export function fmtUSD(n) {
  if (n == null || !isFinite(n)) return '—'
  if (n === 0) return '$0'
  return withUnit(n, '$')
}

/** The same scaling without the currency marker: 412K, 68.0M, 1.4B. */
export function fmtScaled(n) {
  if (n == null || !isFinite(n)) return '—'
  if (n === 0) return '0'
  return withUnit(n, '')
}

/** 3.5x, 11.6x, 0.42x */
export function fmtX(n) {
  if (n == null || !isFinite(n)) return '—'
  return `${trim(n.toFixed(dp(n)))}x`
}

/** 8.0%, 5.12%, 17% */
export function fmtPct(n) {
  if (n == null || !isFinite(n)) return '—'
  const v = n * 100
  const a = Math.abs(v)
  const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3
  return `${trim(v.toFixed(d))}%`
}

/** IRR shown to one decimal, negatives kept (a −18.2% IRR is information). */
export function fmtIRR(n) {
  if (n == null || !isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

/**
 * Counts keep a decimal below 100 — a 41.5-company portfolio should not
 * print as 42 next to the division that produced it.
 */
export function fmtCount(n) {
  if (n == null || !isFinite(n)) return '—'
  return Math.abs(n) >= 100 ? Math.round(n).toString() : String(+n.toFixed(1))
}

/** MOIC^(1/years) − 1. A total loss is −100%, not NaN. */
export function irr(moic, years) {
  if (!isFinite(moic) || !isFinite(years) || years <= 0) return NaN
  if (moic <= 0) return -1
  return Math.pow(moic, 1 / years) - 1
}

/**
 * Smallest exit value at which fn(E) >= target. fn must be non-decreasing.
 * Used for breakeven and target-multiple exits, where the payoff curve has
 * flat regions (a participation cap) that would defeat a naive root solve.
 */
export function minExitFor(fn, target, hi = 1e13) {
  if (!isFinite(target)) return NaN
  if (fn(0) >= target) return 0
  if (fn(hi) < target) return NaN
  let lo = 0
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (fn(mid) >= target) hi = mid
    else lo = mid
  }
  return hi
}
