// Company-level math: entry terms, dilution across rounds, and the exit
// waterfall with liquidity preferences. Pure functions only.
//
// Two modeling choices, both surfaced in the UI as footnotes:
//  1. If you convert to common, the senior and pari passu preferences are
//     assumed to still take their money off the top. Your converted value is
//     therefore ownership × (exit − those prefs), not ownership × exit.
//  2. Follow-on checks are added to your invested basis AND to your pref
//     claim, i.e. the pref multiple applies to everything you put in.

import { fmtUSD, fmtPct, fmtX, irr, minExitFor } from './format.js'

const r = (v, f) => ({ v, f })

export const STARTUP_DEFAULTS = {
  solveFor: 'ownership', // 'ownership' | 'post' | 'check'
  check: 4e6,
  post: 40e6,
  ownership: 0.1,
  roundSize: 10e6,
  prefMultiple: 1,
  participating: false,
  capped: false,
  capMultiple: 3,
  seniorPref: 0,
  pariPref: 0,
  yearsToExit: 7,
  targetMoic: 10,
  rounds: [
    { id: 1, label: 'Series B', mode: 'dilution', dilution: 0.2, poolPct: 0, proRata: 0, post: 0, roundSize: 0 },
    { id: 2, label: 'Series C', mode: 'dilution', dilution: 0.2, poolPct: 0, proRata: 0, post: 0, roundSize: 0 },
    { id: 3, label: 'Series D', mode: 'dilution', dilution: 0.15, poolPct: 0, proRata: 0, post: 0, roundSize: 0 },
  ],
  exits: [100e6, 250e6, 500e6, 1e9, 2.5e9, 5e9, 10e9],
  exitsText: '100, 250, 500, 1b, 2.5b, 5b, 10b',
}

/** Resolve check / post / ownership from whichever two are given. */
export function deriveEntry({ solveFor, check, post, ownership, roundSize }) {
  let c = check
  let p = post
  let o = ownership
  let formula
  if (solveFor === 'ownership') {
    o = p > 0 ? c / p : NaN
    formula = `${fmtUSD(c)} ÷ ${fmtUSD(p)} = ${fmtPct(o)}`
  } else if (solveFor === 'post') {
    p = o > 0 ? c / o : NaN
    formula = `${fmtUSD(c)} ÷ ${fmtPct(o)} = ${fmtUSD(p)} post-money`
  } else {
    c = p * o
    formula = `${fmtPct(o)} × ${fmtUSD(p)} = ${fmtUSD(c)} check`
  }
  const pre = roundSize > 0 ? p - roundSize : NaN
  return { check: c, post: p, ownership: o, pre, formula }
}

/** Walk the future rounds, applying dilution and any pro-rata add-back. */
export function dilutionTrail(entryOwnership, rounds) {
  let o = entryOwnership
  let followOn = 0
  const steps = rounds.map((round) => {
    const before = o
    // Each mode reads only its own fields. A round priced by size over
    // post-money must not fall back to the dilution box the user cannot
    // currently see, and a pro-rata check only counts when there is a
    // post-money to price it at.
    const priced = round.mode === 'round'
    const base = priced ? (round.post > 0 ? round.roundSize / round.post : 0) : round.dilution || 0
    const d = Math.max(0, Math.min(1, base + (round.poolPct || 0)))
    const proRata = priced && round.proRata > 0 && round.post > 0 ? round.proRata : 0
    const addBack = proRata > 0 ? proRata / round.post : 0
    followOn += proRata
    o = before * (1 - d) + addBack
    const parts = [`${fmtPct(before)} × (1 − ${fmtPct(d)})`]
    if (addBack > 0) parts.push(`+ ${fmtUSD(proRata)} ÷ ${fmtUSD(round.post)}`)
    return {
      label: round.label,
      before,
      dilution: d,
      addBack,
      after: o,
      formula: `${parts.join(' ')} = ${fmtPct(o)}`,
      sourceFormula:
        priced && round.post > 0
          ? `${fmtUSD(round.roundSize)} ÷ ${fmtUSD(round.post)} = ${fmtPct(base)} dilution`
          : null,
    }
  })
  return { ownership: o, steps, followOn }
}

/**
 * Proceeds to your position at a given exit value.
 * Monotonically non-decreasing in `exit`, which is what lets the breakeven
 * and target-multiple solves use a bisection.
 */
export function waterfallAt(exit, p) {
  const { invested, ownership, prefMultiple, participating, capMultiple, seniorPref, pariPref } = p
  const prefClaim = prefMultiple * invested
  const available = Math.max(0, exit - seniorPref)
  const pool = prefClaim + pariPref

  // Your slice of the preference pool: paid in full if there's enough to go
  // around, otherwise shared pro rata with the pari passu holders.
  let prefPaid
  if (pool <= 0) prefPaid = 0
  else if (available >= pool) prefPaid = prefClaim
  else prefPaid = (available * prefClaim) / pool

  const commonPool = Math.max(0, exit - seniorPref - pariPref)
  const converted = ownership * commonPool
  const residual = Math.max(0, exit - seniorPref - pariPref - prefClaim)

  if (!participating) {
    if (converted > prefPaid) {
      return {
        payout: converted,
        branch: 'common',
        formula: `converts: ${fmtPct(ownership)} × ${fmtUSD(commonPool)} = ${fmtUSD(converted)} (beats the ${fmtUSD(prefClaim)} pref)`,
      }
    }
    return {
      payout: prefPaid,
      branch: 'pref',
      formula: `takes the pref: ${fmtX(prefMultiple)} × ${fmtUSD(invested)} = ${fmtUSD(prefPaid)} (beats ${fmtUSD(converted)} as common)`,
    }
  }

  const full = prefPaid + ownership * residual
  const cap = capMultiple != null ? capMultiple * invested : Infinity
  const capped = Math.min(full, cap)
  if (converted > capped) {
    return {
      payout: converted,
      branch: 'common',
      formula: `converts past the ${fmtX(capMultiple)} cap: ${fmtPct(ownership)} × ${fmtUSD(commonPool)} = ${fmtUSD(converted)}`,
    }
  }
  if (full > capped) {
    return {
      payout: capped,
      branch: 'capped',
      formula: `capped at ${fmtX(capMultiple)} × ${fmtUSD(invested)} = ${fmtUSD(capped)}`,
    }
  }
  return {
    payout: full,
    branch: 'participating',
    formula: `${fmtUSD(prefPaid)} pref + ${fmtPct(ownership)} × ${fmtUSD(residual)} = ${fmtUSD(full)}`,
  }
}

/** The whole dilution walk on one line, with every round substituted in. */
function ownershipTrailFormula(entryOwnership, trail, ownFinal) {
  if (!trail.steps.length) {
    return `${fmtPct(entryOwnership)} at entry, no further rounds = ${fmtPct(ownFinal)}`
  }
  // Each pro-rata add-back has to be bracketed before the next round's
  // dilution applies to it, otherwise the line reads as a different sum
  // than the one actually computed.
  let expr = fmtPct(entryOwnership)
  for (const step of trail.steps) {
    expr += ` × (1 − ${fmtPct(step.dilution)})`
    if (step.addBack > 0) expr = `(${expr} + ${fmtPct(step.addBack)})`
  }
  return `${expr} = ${fmtPct(ownFinal)}`
}

export function computeStartup(input) {
  const i = { ...STARTUP_DEFAULTS, ...input }
  const entry = deriveEntry(i)
  const trail = dilutionTrail(entry.ownership, i.rounds)
  const invested = entry.check + trail.followOn
  const ownFinal = trail.ownership

  const wf = {
    invested,
    ownership: ownFinal,
    prefMultiple: i.prefMultiple,
    participating: i.participating,
    capMultiple: i.participating && i.capped ? i.capMultiple : null,
    seniorPref: i.seniorPref,
    pariPref: i.pariPref,
  }
  const payout = (E) => waterfallAt(E, wf).payout

  const rows = i.exits.map((E) => {
    const res = waterfallAt(E, wf)
    const moic = invested > 0 ? res.payout / invested : NaN
    return {
      exit: E,
      payout: res.payout,
      moic,
      irr: irr(moic, i.yearsToExit),
      branch: res.branch,
      formula: res.formula,
    }
  })

  const breakeven = minExitFor(payout, invested)
  const targetExit = minExitFor(payout, i.targetMoic * invested)
  const prefClaim = i.prefMultiple * invested

  // Where common overtakes the preference. Closed form for the plain
  // non-participating case (the classic indifference point); solved
  // numerically once a participation cap puts a kink in the curve.
  let conversion, conversionFormula
  if (!i.participating) {
    conversion = ownFinal > 0 ? prefClaim / ownFinal + i.seniorPref + i.pariPref : NaN
    conversionFormula =
      `${fmtX(i.prefMultiple)} × ${fmtUSD(invested)} ÷ ${fmtPct(ownFinal)}` +
      (i.seniorPref + i.pariPref > 0 ? ` + ${fmtUSD(i.seniorPref + i.pariPref)} of other prefs` : '') +
      ` = ${fmtUSD(conversion)}`
  } else {
    conversion = minExitFor((E) => (waterfallAt(E, wf).branch === 'common' ? 1 : 0), 1)
    conversionFormula = isFinite(conversion)
      ? `converting beats the participation cap above ${fmtUSD(conversion)}`
      : 'participating preferred never converts here'
  }

  const totalPrefStack = i.seniorPref + i.pariPref + prefClaim

  return {
    entry,
    trail,
    invested,
    ownFinal,
    rows,
    entryResult: r(
      i.solveFor === 'ownership' ? entry.ownership : i.solveFor === 'post' ? entry.post : entry.check,
      entry.formula,
    ),
    pre: r(
      entry.pre,
      `${fmtUSD(entry.post)} post − ${fmtUSD(i.roundSize)} round = ${fmtUSD(entry.pre)} pre-money`,
    ),
    roundOwnership: r(
      entry.post > 0 ? i.roundSize / entry.post : NaN,
      `${fmtUSD(i.roundSize)} ÷ ${fmtUSD(entry.post)} = ${fmtPct(entry.post > 0 ? i.roundSize / entry.post : NaN)} sold in the round`,
    ),
    ownFinalResult: r(ownFinal, ownershipTrailFormula(entry.ownership, trail, ownFinal)),
    investedResult: r(
      invested,
      trail.followOn > 0
        ? `${fmtUSD(entry.check)} entry + ${fmtUSD(trail.followOn)} follow-on = ${fmtUSD(invested)}`
        : `${fmtUSD(invested)} invested`,
    ),
    prefStack: r(
      totalPrefStack,
      `${fmtUSD(i.seniorPref)} senior + ${fmtUSD(i.pariPref)} pari passu + ${fmtUSD(prefClaim)} yours = ${fmtUSD(totalPrefStack)} of preference ahead of common`,
    ),
    breakeven: r(
      breakeven,
      `smallest exit where proceeds ≥ ${fmtUSD(invested)} invested → ${fmtUSD(breakeven)}`,
    ),
    conversion: r(conversion, conversionFormula),
    targetExit: r(
      targetExit,
      `smallest exit returning ${fmtX(i.targetMoic)} on ${fmtUSD(invested)} → ${fmtUSD(targetExit)}`,
    ),
  }
}

/** Exit value at which this position pays back a whole fund. */
export function fundReturnerExit(fundSize, ownership, wfParams) {
  if (!(fundSize > 0)) return NaN
  return minExitFor((E) => waterfallAt(E, wfParams).payout, fundSize)
}
