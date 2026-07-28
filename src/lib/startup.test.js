import { describe, it, expect } from 'vitest'
import { computeStartup, waterfallAt, dilutionTrail, deriveEntry } from './startup.js'

const M = 1e6
const B = 1e9
const near = (a, b, eps = 1) => expect(Math.abs(a - b)).toBeLessThan(eps)

const base = {
  check: 4 * M,
  post: 40 * M,
  ownership: 0.1,
  invested: 4 * M,
  prefMultiple: 1,
  participating: false,
  capMultiple: null,
  seniorPref: 0,
  pariPref: 0,
}

describe('entry terms', () => {
  it('solves ownership from check and post', () => {
    expect(deriveEntry({ solveFor: 'ownership', check: 4 * M, post: 40 * M }).ownership).toBeCloseTo(0.1)
  })
  it('solves post from check and ownership', () => {
    near(deriveEntry({ solveFor: 'post', check: 4 * M, ownership: 0.1 }).post, 40 * M)
  })
  it('solves the check from ownership and post', () => {
    near(deriveEntry({ solveFor: 'check', post: 40 * M, ownership: 0.1 }).check, 4 * M)
  })
  it('backs out pre-money from the round size', () => {
    near(deriveEntry({ solveFor: 'ownership', check: 4 * M, post: 40 * M, roundSize: 10 * M }).pre, 30 * M)
  })
})

describe('dilution', () => {
  it('compounds three 20% rounds down to 5.12%', () => {
    const rounds = [1, 2, 3].map((id) => ({ id, mode: 'dilution', dilution: 0.2 }))
    expect(dilutionTrail(0.1, rounds).ownership).toBeCloseTo(0.0512, 6)
  })
  it('derives dilution from round size over post-money', () => {
    const t = dilutionTrail(0.1, [{ mode: 'round', roundSize: 25 * M, post: 100 * M }])
    expect(t.steps[0].dilution).toBeCloseTo(0.25)
    expect(t.ownership).toBeCloseTo(0.075)
  })
  it('adds the option pool refresh to the round dilution', () => {
    const t = dilutionTrail(0.1, [{ mode: 'dilution', dilution: 0.2, poolPct: 0.05 }])
    expect(t.ownership).toBeCloseTo(0.075)
  })
  it('buys ownership back with a pro-rata check', () => {
    const t = dilutionTrail(0.1, [{ mode: 'round', roundSize: 20 * M, post: 100 * M, proRata: 2 * M }])
    // 10% × 0.8 = 8%, plus $2M / $100M = 2% → 10%
    expect(t.ownership).toBeCloseTo(0.1, 6)
    near(t.followOn, 2 * M)
  })
})

describe('1x non-participating', () => {
  it('takes the pref in a downside', () => {
    const res = waterfallAt(30 * M, base)
    near(res.payout, 4 * M)
    expect(res.branch).toBe('pref')
  })
  it('converts to common in an upside', () => {
    const res = waterfallAt(200 * M, base)
    near(res.payout, 20 * M)
    expect(res.branch).toBe('common')
  })
  it('flips at the indifference point, $40M here', () => {
    expect(waterfallAt(39 * M, base).branch).toBe('pref')
    expect(waterfallAt(41 * M, base).branch).toBe('common')
  })
  it('pays out nothing above the pref in a total wipeout', () => {
    expect(waterfallAt(0, base).payout).toBe(0)
  })
  it('pays only what is there when the exit is under the pref', () => {
    near(waterfallAt(2 * M, base).payout, 2 * M)
  })
})

describe('2x participating with a 3x cap', () => {
  const p = { ...base, prefMultiple: 2, participating: true, capMultiple: 3 }
  it('takes pref plus participation below the cap', () => {
    const res = waterfallAt(40 * M, p)
    // $8M pref + 10% × ($40M − $8M) = $11.2M
    near(res.payout, 11.2 * M)
    expect(res.branch).toBe('participating')
  })
  it('stops at 3x invested once the cap binds', () => {
    const res = waterfallAt(100 * M, p)
    near(res.payout, 12 * M)
    expect(res.branch).toBe('capped')
  })
  it('converts once common beats the cap', () => {
    const res = waterfallAt(200 * M, p)
    near(res.payout, 20 * M)
    expect(res.branch).toBe('common')
  })
  it('is monotonic across the kinks', () => {
    let prev = -1
    for (let e = 0; e <= 500 * M; e += 5 * M) {
      const y = waterfallAt(e, p).payout
      expect(y).toBeGreaterThanOrEqual(prev)
      prev = y
    }
  })
})

describe('a preference stack ahead of and alongside you', () => {
  it('lets senior preferred take theirs first', () => {
    const res = waterfallAt(10 * M, { ...base, seniorPref: 8 * M })
    near(res.payout, 2 * M)
    expect(res.branch).toBe('pref')
  })
  it('shares pro rata with pari passu holders when there is not enough', () => {
    // $7M available against a $4M + $10M pool → 4/14 of $7M
    const res = waterfallAt(7 * M, { ...base, pariPref: 10 * M })
    near(res.payout, (7 * M * 4) / 14)
  })
  it('leaves other prefs on the table when you convert', () => {
    const res = waterfallAt(200 * M, { ...base, seniorPref: 20 * M, pariPref: 30 * M })
    // 10% × ($200M − $50M)
    near(res.payout, 15 * M)
    expect(res.branch).toBe('common')
  })
})

describe('end to end', () => {
  const s = computeStartup({ rounds: [], exits: [30 * M, 200 * M, 1 * B] })
  it('reports 10% for $4M on $40M post', () => {
    expect(s.ownFinal).toBeCloseTo(0.1)
    near(s.invested, 4 * M)
  })
  it('breaks even at the pref', () => {
    near(s.breakeven.v, 4 * M, 1e3)
  })
  it('names the conversion point', () => {
    near(s.conversion.v, 40 * M, 1e3)
  })
  it('needs a $400M exit for 10x at 10% ownership', () => {
    near(s.targetExit.v, 400 * M, 1e3)
  })
  it('fills the outcome table', () => {
    expect(s.rows).toHaveLength(3)
    near(s.rows[2].payout, 100 * M)
    expect(s.rows[2].moic).toBeCloseTo(25)
    expect(s.rows[2].irr).toBeCloseTo(Math.pow(25, 1 / 7) - 1, 6)
  })
  it('carries dilution through to the exit table', () => {
    const d = computeStartup({
      rounds: [1, 2, 3].map((id) => ({ id, mode: 'dilution', dilution: 0.2 })),
      exits: [1 * B],
    })
    expect(d.ownFinal).toBeCloseTo(0.0512, 6)
    near(d.rows[0].payout, 51.2 * M)
    expect(d.rows[0].moic).toBeCloseTo(12.8)
  })
  it('counts follow-on money in both the basis and the pref', () => {
    const d = computeStartup({
      rounds: [{ id: 1, mode: 'round', roundSize: 20 * M, post: 100 * M, proRata: 2 * M }],
      exits: [10 * M],
    })
    near(d.invested, 6 * M)
    // 1x on $6M invested beats 10% of a $10M exit
    near(d.rows[0].payout, 6 * M)
  })
})
