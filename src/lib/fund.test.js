import { describe, it, expect } from 'vitest'
import { computeFund, FUND_DEFAULTS } from './fund.js'
import { parseMoney, parsePct, parseNum, fmtUSD, fmtX, fmtPct } from './format.js'

const M = 1e6
const B = 1e9
const near = (a, b, eps = 1) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('parsing', () => {
  it('reads bare money as millions and honours suffixes', () => {
    expect(parseMoney('400')).toBe(400 * M)
    expect(parseMoney('$400M')).toBe(400 * M)
    expect(parseMoney('1.4b')).toBe(1.4 * B)
    expect(parseMoney('500k')).toBe(500e3)
    expect(parseMoney('1,250')).toBe(1250 * M)
    expect(parseMoney('')).toBeNaN()
    expect(parseMoney('abc')).toBeNaN()
  })
  it('reads a bare number in a percent field as a percent', () => {
    expect(parsePct('20')).toBeCloseTo(0.2)
    expect(parsePct('8%')).toBeCloseTo(0.08)
    expect(parsePct('0.5')).toBeCloseTo(0.005)
  })
  it('reads multiples with or without the x', () => {
    expect(parseNum('3x')).toBe(3)
    expect(parseNum('2.5')).toBe(2.5)
  })
})

describe('formatting', () => {
  it('scales and trims', () => {
    expect(fmtUSD(400 * M)).toBe('$400M')
    expect(fmtUSD(1.4 * B)).toBe('$1.4B')
    expect(fmtUSD(68 * M)).toBe('$68.0M')
    expect(fmtX(3.5)).toBe('3.5x')
    expect(fmtPct(0.0512)).toBe('5.12%')
  })
})

describe('$400M fund, flat fees', () => {
  const f = computeFund({ feeStructure: 'flat' })
  it('charges 2% on committed for the full 10 years', () => {
    near(f.fees.v, 80 * M)
    expect(f.feePct.v).toBeCloseTo(0.2)
  })
  it('leaves $320M investable', () => {
    near(f.investable.v, 320 * M)
    expect(f.investablePct.v).toBeCloseTo(0.8)
  })
})

describe('$400M fund, stepped-down fees (defaults)', () => {
  const f = computeFund({})
  it('charges full freight through the investment period, then tapers', () => {
    // 5 × $8M + $8M × (0.9 + 0.8 + 0.7 + 0.6 + 0.5)
    near(f.fees.v, 68 * M)
    expect(f.feePct.v).toBeCloseTo(0.17)
  })
  it('leaves $332M investable', () => {
    near(f.investable.v, 332 * M)
  })
  it('needs 1.20x on invested capital just to return the fund', () => {
    expect(f.breakEvenInvested.v).toBeCloseTo(1.2048, 3)
  })
})

describe('gross needed for a 3x net', () => {
  const f = computeFund({})
  it('grosses $1.4B on a $400M fund at 20% carry', () => {
    near(f.distributions.v, 1.4 * B)
    expect(f.grossFund.v).toBeCloseTo(3.5)
  })
  it('pays $200M of carry and $1.2B to LPs', () => {
    near(f.carryDollars.v, 200 * M)
    near(f.lpProceeds.v, 1.2 * B)
    expect(f.lpProceeds.v / FUND_DEFAULTS.fundSize).toBeCloseTo(3)
  })
  it('is 4.22x on invested capital', () => {
    expect(f.grossInvested.v).toBeCloseTo(4.2169, 3)
  })
  it('is an 11.6% net IRR over 10 years', () => {
    expect(f.netIRR.v).toBeCloseTo(0.1161, 3)
  })
  it('holds at a different carry', () => {
    const g = computeFund({ carry: 0.3, targetNet: 3 })
    // D = 400 × (3 − 0.3) / 0.7
    near(g.distributions.v, (400 * M * 2.7) / 0.7)
    expect(g.lpProceeds.v / (400 * M)).toBeCloseTo(3)
  })
})

describe('fund returners and portfolio construction', () => {
  const f = computeFund({})
  it('needs a $4B exit at 10% ownership', () => {
    near(f.returnerExit.v, 4 * B)
  })
  it('needs a $8B exit if you get diluted in half', () => {
    near(f.returnerExitDiluted.v, 4 * B)
    const g = computeFund({ exitDilution: 0.5 })
    near(g.returnerExitDiluted.v, 8 * B)
  })
  it('needs 40% of a $1B outcome to return the fund', () => {
    expect(f.ownershipNeeded.v).toBeCloseTo(0.4)
  })
  it('needs 3.5 fund returners to hit the target', () => {
    expect(f.returnersNeeded.v).toBeCloseTo(3.5)
  })
  it('builds a 41-company portfolio at $4M a check with 50% reserves', () => {
    near(f.initialDollars.v, 166 * M)
    expect(f.numCompanies.v).toBeCloseTo(41.5)
    near(f.impliedPost.v, 40 * M)
    near(f.followOnPer.v, 4 * M)
  })
  it('says 8.4% of the portfolio has to be a fund returner', () => {
    expect(f.returnerShare.v).toBeCloseTo(3.5 / 41.5, 4)
  })
})

describe('fee edge cases', () => {
  it('never charges a negative fee once the taper runs past zero', () => {
    const f = computeFund({ fundLife: 20, stepDown: 0.2 })
    expect(f.schedule.every((row) => row.rate >= 0)).toBe(true)
    // full rate years 1-5, then 0.8,0.6,0.4,0.2,0 and zero thereafter
    near(f.fees.v, 8 * M * (5 + 0.8 + 0.6 + 0.4 + 0.2))
  })
  it('adds expenses and recycling to investable capital', () => {
    const f = computeFund({ annualExpenses: 1e6, recyclingPct: 0.1 })
    near(f.investable.v, 400 * M - 68 * M - 10 * M + 40 * M)
  })
})
