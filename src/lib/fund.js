// Fund-level math. Pure — no React, no formatting decisions beyond the
// formula strings, which carry the substituted numbers so the UI can show
// the work without recomputing anything.

import { fmtUSD, fmtPct, fmtX, fmtIRR, fmtCount, irr } from './format.js'

const r = (v, f) => ({ v, f })

export const FUND_DEFAULTS = {
  fundSize: 400e6,
  feeRate: 0.02,
  feeStructure: 'stepdown', // 'stepdown' | 'flat'
  investPeriod: 5,
  fundLife: 10,
  stepDown: 0.1, // per year, as a fraction of the ORIGINAL fee
  annualExpenses: 0,
  recyclingPct: 0,
  carry: 0.2,
  targetNet: 3,
  ownership: 0.1,
  exitDilution: 0, // total expected dilution between entry and exit
  checkSize: 4e6,
  reserveRatio: 0.5,
  exitValue: 1e9, // for the "what ownership do I need" reverse solve
}

/**
 * Management fee by year.
 * Flat:      the full rate on committed capital for the whole fund life.
 * Step-down: the full rate through the investment period, then reduced by
 *            `stepDown` of the ORIGINAL fee each year after (the common
 *            10%-a-year taper), floored at zero.
 */
export function feeSchedule({ fundSize, feeRate, feeStructure, investPeriod, fundLife, stepDown }) {
  const rows = []
  const life = Math.max(0, Math.round(fundLife))
  const period = Math.max(0, Math.min(Math.round(investPeriod), life))
  for (let year = 1; year <= life; year++) {
    let rate = feeRate
    if (feeStructure === 'stepdown' && year > period) {
      rate = Math.max(0, feeRate * (1 - stepDown * (year - period)))
    }
    rows.push({ year, rate, amount: rate * fundSize })
  }
  return rows
}

export function computeFund(input) {
  const i = { ...FUND_DEFAULTS, ...input }
  const {
    fundSize: F,
    feeRate,
    feeStructure,
    investPeriod,
    fundLife: L,
    annualExpenses,
    recyclingPct,
    carry: c,
    targetNet: n,
    ownership: o,
    exitDilution,
    checkSize,
    reserveRatio,
    exitValue,
  } = i

  const schedule = feeSchedule(i)
  const totalFees = schedule.reduce((s, x) => s + x.amount, 0)
  const feePct = F > 0 ? totalFees / F : NaN
  // Split the stepped-down schedule into its two halves so the line stays a
  // single expression the calculator can replay.
  const periodYears = Math.max(0, Math.min(Math.round(investPeriod), Math.round(L)))
  const taperFees = schedule.filter((x) => x.year > periodYears).reduce((s, x) => s + x.amount, 0)
  const feeFormula =
    feeStructure === 'flat'
      ? `${fmtPct(feeRate)} × ${fmtUSD(F)} × ${L} yrs = ${fmtUSD(totalFees)}`
      : `${fmtPct(feeRate)} × ${fmtUSD(F)} × ${periodYears} yrs + ${fmtUSD(taperFees)} of tapered fees = ${fmtUSD(totalFees)}`

  const totalExpenses = annualExpenses * L
  const recycled = recyclingPct * F
  const investable = F - totalFees - totalExpenses + recycled
  const investablePct = F > 0 ? investable / F : NaN

  // Whole-fund (European) waterfall, no hurdle:
  //   LP net N = D − c(D − F);  set N = nF  ⇒  D = F(n − c)/(1 − c)
  // Below 1x there is no profit to take carry on, so gross and net are the
  // same and the inversion above would overstate what has to come back.
  const D = n < 1 ? F * n : c < 1 ? (F * (n - c)) / (1 - c) : NaN
  const dFormula =
    n < 1
      ? `below 1x there is no carry, so D = nF = ${fmtX(n)} × ${fmtUSD(F)} = ${fmtUSD(D)}`
      : `D = F(n − c) ÷ (1 − c) = ${fmtUSD(F)} × (${fmtX(n)} − ${fmtPct(c)}) ÷ ${(1 - c).toFixed(2)} = ${fmtUSD(D)}`
  const carryDollars = Math.max(0, c * (D - F))
  const lpProceeds = D - carryDollars
  const grossFund = F > 0 ? D / F : NaN
  const grossInvested = investable > 0 ? D / investable : NaN
  const netIRR = irr(n, L)
  const grossIRR = irr(grossFund, L)

  // Fund returners
  const exitOwn = o * (1 - exitDilution)
  const returnerExit = o > 0 ? F / o : NaN
  const returnerExitDiluted = exitOwn > 0 ? F / exitOwn : NaN
  const ownershipNeeded = exitValue > 0 ? F / exitValue : NaN
  const returnersNeeded = F > 0 ? D / F : NaN

  // Portfolio construction
  const initialDollars = investable * (1 - reserveRatio)
  const numCompanies = checkSize > 0 ? initialDollars / checkSize : NaN
  const impliedPost = o > 0 ? checkSize / o : NaN
  const followOnPer = numCompanies > 0 ? (investable * reserveRatio) / numCompanies : NaN
  const returnerShare = numCompanies > 0 ? returnersNeeded / numCompanies : NaN
  const avgExitPerCo = numCompanies > 0 ? D / numCompanies : NaN
  const breakEvenInvested = investable > 0 ? F / investable : NaN

  return {
    schedule,
    fees: r(totalFees, feeFormula),
    feePct: r(feePct, `${fmtUSD(totalFees)} ÷ ${fmtUSD(F)} = ${fmtPct(feePct)} of the fund`),
    expenses: r(
      totalExpenses,
      `${fmtUSD(annualExpenses)} per yr × ${L} yrs = ${fmtUSD(totalExpenses)}`,
    ),
    recycled: r(recycled, `${fmtPct(recyclingPct)} × ${fmtUSD(F)} = ${fmtUSD(recycled)}`),
    investable: r(
      investable,
      `${fmtUSD(F)} − ${fmtUSD(totalFees)} fees` +
        (totalExpenses ? ` − ${fmtUSD(totalExpenses)} expenses` : '') +
        (recycled ? ` + ${fmtUSD(recycled)} recycled` : '') +
        ` = ${fmtUSD(investable)}`,
    ),
    investablePct: r(
      investablePct,
      `${fmtUSD(investable)} ÷ ${fmtUSD(F)} = ${fmtPct(investablePct)} of committed capital`,
    ),
    breakEvenInvested: r(
      breakEvenInvested,
      `${fmtUSD(F)} ÷ ${fmtUSD(investable)} = ${fmtX(breakEvenInvested)} on invested capital just to return the fund`,
    ),

    distributions: r(D, dFormula),
    grossFund: r(grossFund, `${fmtUSD(D)} ÷ ${fmtUSD(F)} = ${fmtX(grossFund)} gross on fund size`),
    grossInvested: r(
      grossInvested,
      `${fmtUSD(D)} ÷ ${fmtUSD(investable)} = ${fmtX(grossInvested)} gross on invested capital`,
    ),
    carryDollars: r(
      carryDollars,
      `${fmtPct(c)} × (${fmtUSD(D)} − ${fmtUSD(F)}) = ${fmtUSD(carryDollars)} to the GP`,
    ),
    lpProceeds: r(
      lpProceeds,
      `${fmtUSD(D)} − ${fmtUSD(carryDollars)} carry = ${fmtUSD(lpProceeds)} to LPs (${fmtX(lpProceeds / F)} net)`,
    ),
    netIRR: r(netIRR, `${fmtX(n)}^(1/${L}) − 1 = ${fmtIRR(netIRR)} net IRR`),
    grossIRR: r(grossIRR, `${fmtX(grossFund)}^(1/${L}) − 1 = ${fmtIRR(grossIRR)} gross IRR`),

    returnerExit: r(returnerExit, `${fmtUSD(F)} ÷ ${fmtPct(o)} = ${fmtUSD(returnerExit)} exit`),
    returnerExitDiluted: r(
      returnerExitDiluted,
      `${fmtUSD(F)} ÷ (${fmtPct(o)} × (1 − ${fmtPct(exitDilution)})) = ${fmtUSD(F)} ÷ ${fmtPct(exitOwn)} = ${fmtUSD(returnerExitDiluted)}`,
    ),
    ownershipNeeded: r(
      ownershipNeeded,
      `${fmtUSD(F)} ÷ ${fmtUSD(exitValue)} = ${fmtPct(ownershipNeeded)} ownership at exit`,
    ),
    returnersNeeded: r(
      returnersNeeded,
      `${fmtUSD(D)} ÷ ${fmtUSD(F)} = ${fmtCount(returnersNeeded)} fund returners`,
    ),

    initialDollars: r(
      initialDollars,
      `${fmtUSD(investable)} × (1 − ${fmtPct(reserveRatio)}) = ${fmtUSD(initialDollars)} for initial checks`,
    ),
    numCompanies: r(
      numCompanies,
      `${fmtUSD(initialDollars)} ÷ ${fmtUSD(checkSize)} = ${fmtCount(numCompanies)} companies`,
    ),
    impliedPost: r(
      impliedPost,
      `${fmtUSD(checkSize)} ÷ ${fmtPct(o)} = ${fmtUSD(impliedPost)} post-money at entry`,
    ),
    followOnPer: r(
      followOnPer,
      `${fmtUSD(investable)} × ${fmtPct(reserveRatio)} ÷ ${fmtCount(numCompanies)} = ${fmtUSD(followOnPer)} of reserves per company`,
    ),
    returnerShare: r(
      returnerShare,
      `${fmtCount(returnersNeeded)} ÷ ${fmtCount(numCompanies)} = ${fmtPct(returnerShare)} of the portfolio must be fund returners`,
    ),
    avgExitPerCo: r(
      avgExitPerCo,
      `${fmtUSD(D)} ÷ ${fmtCount(numCompanies)} = ${fmtUSD(avgExitPerCo)} average proceeds per company`,
    ),
  }
}
