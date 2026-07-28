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
        <Result big label="Investable capital" r={f.investable} fmt={fmtUSD} />
        <Result label="…as % of committed" r={f.investablePct} fmt={fmtPct} />
        <Result label="Total fees over life" r={f.fees} fmt={fmtUSD} />
        <Result label="Fees as % of fund" r={f.feePct} fmt={fmtPct} />
        {state.annualExpenses > 0 && <Result label="Fund expenses" r={f.expenses} fmt={fmtUSD} />}
        {state.recyclingPct > 0 && <Result label="Recycled capital" r={f.recycled} fmt={fmtUSD} />}
        <Result tone="warn" label="Fee drag" r={f.breakEvenInvested} fmt={fmtX} />
      </Section>

      <Section title="Gross vs net">
        <div className="grid">
          <NumberField label="Target net multiple" kind="num" value={state.targetNet} onChange={on('targetNet')} hint="to LPs" />
        </div>
        <Result big label="Gross distributions needed" r={f.distributions} fmt={fmtUSD} />
        <Result label="Gross MOIC on fund size" r={f.grossFund} fmt={fmtX} />
        <Result label="Gross MOIC on invested capital" r={f.grossInvested} fmt={fmtX} />
        <Result label="Carry to the GP" r={f.carryDollars} fmt={fmtUSD} />
        <Result label="Proceeds to LPs" r={f.lpProceeds} fmt={fmtUSD} />
        <Result label="Net IRR" r={f.netIRR} fmt={fmtIRR} />
        <Result label="Gross IRR" r={f.grossIRR} fmt={fmtIRR} />
      </Section>

      <Section title="Fund returners">
        <div className="grid">
          <NumberField label="Ownership at entry" kind="pct" value={state.ownership} onChange={on('ownership')} />
          <NumberField label="Dilution to exit" kind="pct" value={state.exitDilution} onChange={on('exitDilution')} hint="total" />
          <NumberField label="Test an exit" value={state.exitValue} onChange={on('exitValue')} />
        </div>
        <Result big label="Exit that returns the fund" r={f.returnerExit} fmt={fmtUSD} />
        {state.exitDilution > 0 && (
          <Result label="…after dilution to exit" r={f.returnerExitDiluted} fmt={fmtUSD} />
        )}
        <Result
          label={`Ownership needed at ${fmtUSD(state.exitValue)}`}
          r={f.ownershipNeeded}
          fmt={fmtPct}
        />
        <Result label="Fund returners needed" r={f.returnersNeeded} fmt={fmtCount} />
      </Section>

      <Section title="Portfolio construction">
        <div className="grid">
          <NumberField label="Initial check" value={state.checkSize} onChange={on('checkSize')} />
          <NumberField label="Reserves" kind="pct" value={state.reserveRatio} onChange={on('reserveRatio')} hint="of investable" />
        </div>
        <Result big label="Companies in the portfolio" r={f.numCompanies} fmt={fmtCount} />
        <Result label="Dollars for initial checks" r={f.initialDollars} fmt={fmtUSD} />
        <Result label="Implied entry post-money" r={f.impliedPost} fmt={fmtUSD} />
        <Result label="Reserves per company" r={f.followOnPer} fmt={fmtUSD} />
        <Result tone="warn" label="Portfolio that must be fund returners" r={f.returnerShare} fmt={fmtPct} />
        <Result label="Average proceeds per company" r={f.avgExitPerCo} fmt={fmtUSD} />
      </Section>

      <Section title="Fee schedule" open={false}>
        <div className="scroll-x">
          <table className="outcomes">
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Rate</th>
                <th className="num">Fee</th>
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
