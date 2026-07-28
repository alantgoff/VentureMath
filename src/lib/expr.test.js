import { describe, it, expect } from 'vitest'
import { compute, extract, numberValue, tokenize, parse } from './expr.js'
import { computeFund } from './fund.js'
import { computeStartup } from './startup.js'

const M = 1e6
const B = 1e9

describe('number literals', () => {
  it('reads the notation the app prints', () => {
    expect(numberValue('$400M')).toBe(400 * M)
    expect(numberValue('1.4B')).toBe(1.4 * B)
    expect(numberValue('8%')).toBeCloseTo(0.08)
    expect(numberValue('3.5x')).toBe(3.5)
    expect(numberValue('10')).toBe(10)
    expect(numberValue('500K')).toBe(500e3)
  })
})

describe('evaluation', () => {
  const value = (s) => compute(s)?.value

  it('applies precedence and parentheses', () => {
    expect(value('2 + 3 × 4')).toBe(14)
    expect(value('(2 + 3) × 4')).toBe(20)
    expect(value('$400M ÷ 10%')).toBe(4 * B)
  })
  it('handles powers right-associatively for IRR maths', () => {
    expect(value('2 ^ 3 ^ 2')).toBe(512)
    expect(value('3 ^ (1 ÷ 10) − 1')).toBeCloseTo(0.1161, 4)
  })
  it('handles a leading minus', () => {
    expect(value('−5 + 2')).toBe(-3)
  })
  it('rejects nonsense rather than guessing', () => {
    expect(compute('2 +')).toBeNull()
    expect(compute('(2 + 3')).toBeNull()
    expect(compute('hello')).toBeNull()
    expect(compute('')).toBeNull()
    expect(compute('2 & 3')).toBeNull()
  })
  it('records one step per operation, in the notation it was written in', () => {
    const { steps } = compute('$400M ÷ 10%')
    expect(steps).toHaveLength(1)
    expect(steps[0].text).toBe('$400M ÷ 10% = $4.0B')
  })
  it('reduces a chain one operation at a time, each operand before its parent', () => {
    expect(compute('10% × (1 − 20%) × (1 − 20%)').steps.map((s) => s.text)).toEqual([
      '1 − 20% = 0.8',
      '10% × 0.8 = 0.08',
      '1 − 20% = 0.8',
      '0.08 × 0.8 = 0.064',
    ])
  })
  it('keeps track of what is money and what is a ratio', () => {
    // $332M ÷ $400M is 0.83, not $0.83; $400M × 2.8 is still dollars.
    expect(compute('$332M ÷ $400M').money).toBe(false)
    expect(compute('$332M ÷ $400M').value).toBeCloseTo(0.83)
    expect(compute('$400M × 2.8').money).toBe(true)
    expect(compute('$400M ÷ 10%').money).toBe(true)
    expect(compute('3.0x − 20%').money).toBe(false)
    expect(compute('$400M × (3.0x − 20%) ÷ 0.8').steps.map((s) => s.text)).toEqual([
      '3.0x − 20% = 2.8',
      '$400M × 2.8 = $1.12B',
      '$1.12B ÷ 0.8 = $1.4B',
    ])
  })
  it('parses what the tokenizer produces for a nested expression', () => {
    expect(parse(tokenize('10% × (1 − 20%) × (1 − 20%)'))).toBeTruthy()
    expect(compute('10% × (1 − 20%) × (1 − 20%)').value).toBeCloseTo(0.064, 6)
  })
})

describe('reading a printed formula back', () => {
  it('pulls the arithmetic out of a prose-flavoured line', () => {
    const got = extract('$8.0M pref + 5.44% × $92.0M = $13.0M', 13.0048 * M)
    expect(got).toBeTruthy()
    expect(got.value).toBeCloseTo(13.0048 * M, 0)
    expect(got.steps).toHaveLength(2)
  })
  it('takes the last expression when the line restates a symbolic form', () => {
    const got = extract(
      'D = F(n − c) ÷ (1 − c) = $400M × (3.0x − 20.0%) ÷ 0.80 = $1.4B',
      1.4 * B,
    )
    expect(got.value).toBeCloseTo(1.4 * B, 0)
  })
  it('refuses a line whose arithmetic does not reproduce the result', () => {
    expect(extract('$400M ÷ 10% = $4.0B', 99 * M)).toBeNull()
  })
  it('refuses a solved-by-search line with no expression in it', () => {
    expect(extract('smallest exit where proceeds ≥ $4.0M invested → $4.0M', 4 * M)).toBeNull()
  })
  it('refuses a bare restatement with no operator', () => {
    expect(extract('$4.0M invested = $4.0M', 4 * M)).toBeNull()
  })
  it('gives back an expression the calculator can hold', () => {
    expect(extract('$400M ÷ 10% = $4.0B', 4 * B).expression).toBe('$400M ÷ 10%')
  })
})

// The formula lines are prose, and `extract` guesses at them. This walks every
// result the app can produce and insists that each guess either reproduces the
// stated value or declines to answer — never that it quietly disagrees.
describe('every formula the app prints', () => {
  const results = []
  const collect = (obj) => {
    for (const [key, r] of Object.entries(obj)) {
      if (r && typeof r === 'object' && 'v' in r && 'f' in r) results.push([key, r])
    }
  }

  collect(computeFund({}))
  collect(computeFund({ feeStructure: 'flat', exitDilution: 0.4, recyclingPct: 0.1, annualExpenses: 1e6 }))
  collect(computeFund({ targetNet: 0.8 }))
  collect(computeFund({ carry: 0.3, ownership: 0.055, checkSize: 750e3 }))
  collect(computeStartup({}))
  collect(computeStartup({ participating: true, capped: true, prefMultiple: 2 }))
  collect(computeStartup({ seniorPref: 20e6, pariPref: 30e6, rounds: [] }))
  collect(
    computeStartup({
      solveFor: 'post',
      rounds: [{ id: 1, mode: 'round', roundSize: 20e6, post: 100e6, proRata: 2e6 }],
    }),
  )

  it('has results to check', () => {
    expect(results.length).toBeGreaterThan(80)
  })

  it('never disagrees with itself', () => {
    for (const [key, r] of results) {
      const got = extract(r.f, r.v)
      if (got) {
        const scale = Math.max(Math.abs(got.value), Math.abs(r.v))
        expect(Math.abs(got.value - r.v), `${key}: ${r.f}`).toBeLessThanOrEqual(scale * 0.02 + 1e-9)
      }
    }
  })

  it('can replay the arithmetic for most of them', () => {
    const replayable = results.filter(([, r]) => extract(r.f, r.v))
    expect(replayable.length / results.length).toBeGreaterThan(0.6)
  })
})

describe('outcome rows', () => {
  const s = computeStartup({ exits: [30e6, 200e6, 1e9] })
  it('replays each row of the exit table', () => {
    for (const row of s.rows) {
      const got = extract(row.formula, row.payout)
      expect(got, row.formula).toBeTruthy()
      expect(got.value).toBeCloseTo(row.payout, -3)
    }
  })
})
