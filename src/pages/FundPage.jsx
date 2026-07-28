import { useMemo } from 'react'
import NumberField, { Segmented } from '../components/NumberField.jsx'
import Result, { Section, Summary } from '../components/Result.jsx'
import { computeFund } from '../lib/fund.js'
import { fmtUSD, fmtPct, fmtX, fmtIRR, fmtCount } from '../lib/format.js'

export default function FundPage({ state, set, reset }) {
  const f = useMemo(() => computeFund(state), [state])
  const on = (key) => (v) => set({ [key]: v })

  return (
    <>
      <Summary
        items={[
          { label: 'Investable', value: fmtUSD(f.investable.v) },
          { label: 'Fund returner', value: fmtUSD(f.returnerExit.v) },
          { label: `Gross @ ${fmtX(state.targetNet)} net`, value: fmtX(f.grossFund.v) },
        ]}
      />

      <Section title="Fund terms">
        <div className="grid">
          <NumberField label="Fund size" value={state.fundSize} onChange={on('fundSize')} hint="bare = $M" />
          <NumberField label="Mgmt fee" kind="pct" value={state.feeRate} onChange={on('feeRate')} />
          <Segmented
            label="Fee structure"
            value={state.feeStructure}
            onChange={on('feeStructure')}
            options={[
              { value: 'stepdown', label: 'Step-down' },
              { value: 'flat', label: 'Flat' },
            ]}
          />
          <NumberField label="Investment period" kind="num" value={state.investPeriod} onChange={on('investPeriod')} hint="yrs" />
          <NumberField label="Fund life" kind="num" value={state.fundLife} onChange={on('fundLife')} hint="yrs" />
          {state.feeStructure === 'stepdown' && (
            <NumberField label="Step-down" kind="pct" value={state.stepDown} onChange={on('stepDown')} hint="per yr" />
          )}
          <NumberField label="Fund expenses" value={state.annualExpenses} onChange={on('annualExpenses')} hint="per yr" />
          <NumberField label="Recycling" kind="pct" value={state.recyclingPct} onChange={on('recyclingPct')} hint="of fund" />
          <NumberField label="Carry" kind="pct" value={state.carry} onChange={on('carry')} />
        </div>
      </Section>

      <Section title="Fees & investable capital">
        <Result big label="Investable capital" value={fmtUSD(f.investable.v)} formula={f.investable.f} />
        <Result label="…as % of committed" value={fmtPct(f.investablePct.v)} formula={f.investablePct.f} />
        <Result label="Total fees over life" value={fmtUSD(f.fees.v)} formula={f.fees.f} />
        <Result label="Fees as % of fund" value={fmtPct(f.feePct.v)} formula={f.feePct.f} />
        {state.annualExpenses > 0 && (
          <Result label="Fund expenses" value={fmtUSD(f.expenses.v)} formula={f.expenses.f} />
        )}
        {state.recyclingPct > 0 && (
          <Result label="Recycled capital" value={fmtUSD(f.recycled.v)} formula={f.recycled.f} />
        )}
        <Result
          tone="warn"
          label="Fee drag"
          value={fmtX(f.breakEvenInvested.v)}
          formula={f.breakEvenInvested.f}
        />
      </Section>

      <Section title="Gross vs net">
        <div className="grid">
          <NumberField label="Target net multiple" kind="num" value={state.targetNet} onChange={on('targetNet')} hint="to LPs" />
        </div>
        <Result big label="Gross distributions needed" value={fmtUSD(f.distributions.v)} formula={f.distributions.f} />
        <Result label="Gross MOIC on fund size" value={fmtX(f.grossFund.v)} formula={f.grossFund.f} />
        <Result label="Gross MOIC on invested capital" value={fmtX(f.grossInvested.v)} formula={f.grossInvested.f} />
        <Result label="Carry to the GP" value={fmtUSD(f.carryDollars.v)} formula={f.carryDollars.f} />
        <Result label="Proceeds to LPs" value={fmtUSD(f.lpProceeds.v)} formula={f.lpProceeds.f} />
        <Result label="Net IRR" value={fmtIRR(f.netIRR.v)} formula={f.netIRR.f} />
        <Result label="Gross IRR" value={fmtIRR(f.grossIRR.v)} formula={f.grossIRR.f} />
      </Section>

      <Section title="Fund returners">
        <div className="grid">
          <NumberField label="Ownership at entry" kind="pct" value={state.ownership} onChange={on('ownership')} />
          <NumberField label="Dilution to exit" kind="pct" value={state.exitDilution} onChange={on('exitDilution')} hint="total" />
          <NumberField label="Test an exit" value={state.exitValue} onChange={on('exitValue')} />
        </div>
        <Result big label="Exit that returns the fund" value={fmtUSD(f.returnerExit.v)} formula={f.returnerExit.f} />
        {state.exitDilution > 0 && (
          <Result
            label="…after dilution to exit"
            value={fmtUSD(f.returnerExitDiluted.v)}
            formula={f.returnerExitDiluted.f}
          />
        )}
        <Result
          label={`Ownership needed at ${fmtUSD(state.exitValue)}`}
          value={fmtPct(f.ownershipNeeded.v)}
          formula={f.ownershipNeeded.f}
        />
        <Result
          label="Fund returners needed"
          value={fmtCount(f.returnersNeeded.v)}
          formula={f.returnersNeeded.f}
        />
      </Section>

      <Section title="Portfolio construction">
        <div className="grid">
          <NumberField label="Initial check" value={state.checkSize} onChange={on('checkSize')} />
          <NumberField label="Reserves" kind="pct" value={state.reserveRatio} onChange={on('reserveRatio')} hint="of investable" />
        </div>
        <Result big label="Companies in the portfolio" value={fmtCount(f.numCompanies.v)} formula={f.numCompanies.f} />
        <Result label="Dollars for initial checks" value={fmtUSD(f.initialDollars.v)} formula={f.initialDollars.f} />
        <Result label="Implied entry post-money" value={fmtUSD(f.impliedPost.v)} formula={f.impliedPost.f} />
        <Result label="Reserves per company" value={fmtUSD(f.followOnPer.v)} formula={f.followOnPer.f} />
        <Result
          tone="warn"
          label="Portfolio that must be fund returners"
          value={fmtPct(f.returnerShare.v)}
          formula={f.returnerShare.f}
        />
        <Result label="Average proceeds per company" value={fmtUSD(f.avgExitPerCo.v)} formula={f.avgExitPerCo.f} />
      </Section>

      <Section title="Fee schedule" open={false}>
        <div className="scroll-x">
          <table className="outcomes">
            <thead>
              <tr>
                <th>Year</th>
                <th>Rate</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {f.schedule.map((row) => (
                <tr key={row.year}>
                  <th scope="row">{row.year}</th>
                  <td className="num">{fmtPct(row.rate)}</td>
                  <td className="num strong">{fmtUSD(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <button type="button" className="reset" onClick={reset}>
        Reset fund to defaults
      </button>
    </>
  )
}
