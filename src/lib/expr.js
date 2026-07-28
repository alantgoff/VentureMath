// A tiny arithmetic engine over the notation the app already writes:
// $400M, 8%, 3.5x, plain numbers, + − × ÷ ^ and parentheses.
//
// It does double duty. The Calc page parses what you type with it, and it
// also re-reads the formula lines printed under every result so tapping one
// can replay the arithmetic step by step. That second job is only safe
// because `extract` refuses to return anything whose recomputed value does
// not match the result it came from — see `matches` below.

import { fmtUSD, fmtScaled } from './format.js'

const SCALE = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }
const OPS = {
  '+': { prec: 1, apply: (a, b) => a + b, show: '+' },
  '-': { prec: 1, apply: (a, b) => a - b, show: '−' },
  '*': { prec: 2, apply: (a, b) => a * b, show: '×' },
  '/': { prec: 2, apply: (a, b) => a / b, show: '÷' },
  '^': { prec: 3, apply: (a, b) => Math.pow(a, b), show: '^', right: true },
}

const NORMALISE = { '×': '*', '·': '*', '÷': '/', '−': '-', '–': '-' }

export function tokenize(input) {
  const src = String(input)
  const tokens = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c) || c === ',' || c === ':') {
      i++
      continue
    }
    if (c === '(' || c === ')') {
      tokens.push({ type: c })
      i++
      continue
    }
    const op = NORMALISE[c] || c
    if (OPS[op]) {
      tokens.push({ type: 'op', op })
      i++
      continue
    }
    // A number: optional $, digits, optional K/M/B/T or % or x suffix.
    const m = /^\$?\d*\.?\d+[kmbtKMBT]?%?x?/.exec(src.slice(i))
    if (m && /\d/.test(m[0])) {
      tokens.push({ type: 'num', text: m[0], value: numberValue(m[0]), money: m[0].includes('$') })
      i += m[0].length
      continue
    }
    const word = /^[A-Za-z][A-Za-z-]*/.exec(src.slice(i))
    if (word) {
      tokens.push({ type: 'word', text: word[0] })
      i += word[0].length
      continue
    }
    tokens.push({ type: 'bad', text: c })
    i++
  }
  return tokens
}

export function numberValue(text) {
  const s = text.replace(/[$,\s]/g, '')
  const n = parseFloat(s)
  if (!isFinite(n)) return NaN
  if (s.endsWith('%')) return n / 100
  const suffix = s.replace(/[\d.]/g, '').replace(/[%x]/gi, '').toLowerCase()
  return suffix && SCALE[suffix] ? n * SCALE[suffix] : n
}

/**
 * Recursive descent over the token list. Returns an AST, or null if the
 * tokens are not a well-formed expression.
 */
export function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]
  const eat = () => tokens[pos++]

  function primary() {
    const t = peek()
    if (!t) return null
    if (t.type === 'op' && (t.op === '-' || t.op === '+')) {
      eat()
      const inner = primary()
      return inner && t.op === '-' ? { kind: 'neg', a: inner } : inner
    }
    if (t.type === 'num') {
      eat()
      return { kind: 'num', value: t.value, text: t.text, money: t.money }
    }
    if (t.type === '(') {
      eat()
      const inner = expression(0)
      if (!inner || !peek() || peek().type !== ')') return null
      eat()
      return { kind: 'group', a: inner }
    }
    return null
  }

  function expression(minPrec) {
    let left = primary()
    if (!left) return null
    for (;;) {
      const t = peek()
      if (!t || t.type !== 'op') break
      const info = OPS[t.op]
      if (!info || info.prec < minPrec) break
      eat()
      const nextMin = info.right ? info.prec : info.prec + 1
      const right = expression(nextMin)
      if (!right) return null
      left = { kind: 'op', op: t.op, a: left, b: right }
    }
    return left
  }

  const ast = expression(0)
  return ast && pos === tokens.length ? ast : null
}

/**
 * Whether a result is still money. Dollars divided by dollars is a plain
 * ratio — $332M ÷ $400M is 0.83, not $0.83 — while dollars times or over a
 * scalar stays money.
 */
function moneyOf(op, a, b) {
  if (op === '^') return false
  if (op === '/') return a && !b
  return a || b
}

/**
 * Walk the AST, recording each binary operation as it is reduced. Operands
 * that came straight from the source keep the notation they were written in,
 * so a step reads "$400M ÷ 10.0% = $4.0B" rather than restating the 10% as
 * the 0.1 it is underneath.
 */
export function evaluate(ast) {
  const steps = []
  const walk = (node) => {
    if (node.kind === 'num') return { value: node.value, text: node.text, money: node.money }
    if (node.kind === 'group') return walk(node.a)
    if (node.kind === 'neg') {
      const a = walk(node.a)
      return { value: -a.value, text: `−${a.text}`, money: a.money }
    }
    const a = walk(node.a)
    const b = walk(node.b)
    const value = OPS[node.op].apply(a.value, b.value)
    const money = moneyOf(node.op, a.money, b.money)
    const text = formatValue(value, money)
    steps.push({ text: `${a.text} ${OPS[node.op].show} ${b.text} = ${text}`, value, money })
    return { value, text, money }
  }
  const top = walk(ast)
  return { value: top.value, money: top.money, steps }
}

/**
 * Compact display for a computed value, borrowing the app's own scaling so a
 * step reads like the rest of the UI. Fractions (a percent operand partway
 * through) and whole counts are left alone — "0.1" and "12", not "$0.10"
 * and "12.0".
 */
export function formatValue(n, money) {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) < 1) return String(+n.toPrecision(4))
  if (!money && Number.isInteger(n) && Math.abs(n) < 1e5) return String(n)
  return money ? fmtUSD(n) : fmtScaled(n)
}

/** Parse and evaluate a raw expression string, as typed into the calculator. */
export function compute(text) {
  const tokens = tokenize(text)
  if (!tokens.length || tokens.some((t) => t.type === 'bad' || t.type === 'word')) return null
  const ast = parse(tokens)
  if (!ast) return null
  const { value, steps, money } = evaluate(ast)
  return isFinite(value) ? { value, steps, money } : null
}

const matches = (a, b) => {
  if (!isFinite(a) || !isFinite(b)) return false
  if (a === b) return true
  const scale = Math.max(Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= Math.max(scale * 0.02, 1e-9)
}

/**
 * Pull the arithmetic out of a printed formula line so it can be replayed.
 *
 * Formula lines are prose-flavoured — "$8.0M pref + 5.44% × $92.0M = $13.0M"
 * — so words are dropped and the segment before the final `=` is tried as an
 * expression. That is a guess, which is why the result is thrown away unless
 * it reproduces `expected`. A line that does not check out returns null and
 * the UI says so rather than showing arithmetic it cannot stand behind.
 */
export function extract(formula, expected) {
  if (!formula) return null
  const segments = String(formula).split('=')
  if (segments.length < 2) return null
  const candidate = segments[segments.length - 2]
  const tokens = tokenize(candidate).filter((t) => t.type !== 'word')
  if (!tokens.length || tokens.some((t) => t.type === 'bad')) return null
  if (!tokens.some((t) => t.type === 'op')) return null
  const ast = parse(tokens)
  if (!ast) return null
  const { value, steps, money } = evaluate(ast)
  if (!isFinite(value)) return null
  if (expected != null && !matches(value, expected)) return null
  return { value, steps, expression: rebuild(tokens), money }
}

/** Re-emit the token list as something the calculator input can hold. */
function rebuild(tokens) {
  return tokens
    .map((t) => {
      if (t.type === 'num') return t.text
      if (t.type === 'op') return ` ${OPS[t.op].show} `
      return t.type
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
