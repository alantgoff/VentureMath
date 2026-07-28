import { useMemo } from 'react'
import NumberField, { Segmented, TextField, Toggle } from '../components/NumberField.jsx'
import Result, { Formula, Section, Summary } from '../components/Result.jsx'
import OutcomeTable from '../components/OutcomeTable.jsx'
import { computeStartup, fundReturnerExit } from '../lib/startup.js'
import { fmtUSD, fmtPct, fmtX, parseMoney } from '../lib/format.js'

const parseExits = (text) =>
  String(text)
    .split(/[,\s]+/)
    .map(parseMoney)
    .filter((n) => isFinite(n) && n >= 0)

const blankRound = (id, n) => ({
  id,
  label: `Round ${n}`,
  mode: 'dilution',
  dilution: 0.2,
  poolPct: 0,
  proRata: 0,
  post: 0,
  roundSize: 0,
})

export default function StartupPage({ state, set, reset, fundSize }) {
  const exits = useMemo(() => parseExits(state.exitsText), [state.exitsText])
  const s = useMemo(() => computeStartup({ ...state, exits }), [state, exits])
  const on = (key) => (v) => set({ [key]: v })

  const setRound = (id, patch) =>
    set({ rounds: state.rounds.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  // Ids come from the existing rows rather than a module counter, which would
  // restart at the same number after a reload and collide with saved rounds.
  const addRound = () =>
    set({
      rounds: [
        ...state.rounds,
        blankRound(Math.max(0, ...state.rounds.map((r) => r.id)) + 1, state.rounds.length + 1),
      ],
    })
  const dropRound = (id) => set({ rounds: state.rounds.filter((r) => r.id !== id) })

  const wfParams = useMemo(
    () => ({
      invested: s.invested,
      ownership: s.ownFinal,
      prefMultiple: state.prefMultiple,
      participating: state.participating,
      capMultiple: state.participating && state.capped ? state.capMultiple : null,
      seniorPref: state.seniorPref,
      pariPref: state.pariPref,
    }),
    [s.invested, s.ownFinal, state],
  )
  const returnerExit = useMemo(
    () => fundReturnerExit(fundSize, s.ownFinal, wfParams),
    [fundSize, s.ownFinal, wfParams],
  )

  return (
    <>
      <Summary
        items={[
          { label: 'Own at exit', value: fmtPct(s.ownFinal) },
          { label: 'Breakeven', value: fmtUSD(s.breakeven.v) },
          { label: 'Invested', value: fmtUSD(s.invested) },
        ]}
      />

      <Section title="Entry">
        <Segmented
          label="Solve for"
          value={state.solveFor}
          onChange={on('solveFor')}
          options={[
            { value: 'ownership', label: 'Ownership' },
            { value: 'post', label: 'Post-money' },
            { value: 'check', label: 'Check' },
          ]}
        />
        <div className="grid">
          {state.solveFor !== 'check' && (
            <NumberField label="Check" value={state.check} onChange={on('check')} hint="bare = $M" />
          )}
          {state.solveFor !== 'post' && (
            <NumberField label="Post-money" value={state.post} onChange={on('post')} />
          )}
          {state.solveFor !== 'ownership' && (
            <NumberField label="Ownership" kind="pct" value={state.ownership} onChange={on('ownership')} />
          )}
          <NumberField label="Round size" value={state.roundSize} onChange={on('roundSize')} hint="optional" />
        </div>
        <Result
          big
          label={
            state.solveFor === 'ownership'
              ? 'Your ownership'
              : state.solveFor === 'post'
                ? 'Post-money'
                : 'Check size'
          }
          value={
            state.solveFor === 'ownership'
              ? fmtPct(s.entry.ownership)
              : state.solveFor === 'post'
                ? fmtUSD(s.entry.post)
                : fmtUSD(s.entry.check)
          }
          formula={s.entryResult.f}
          rawValue={s.entryResult.v}
        />
        {state.roundSize > 0 && (
          <>
            <Result label="Pre-money" r={s.pre} fmt={fmtUSD} />
            <Result label="Round sells" r={s.roundOwnership} fmt={fmtPct} />
          </>
        )}
      </Section>

      <Section title="Preference terms">
        <div className="grid">
          <NumberField label="Pref multiple" kind="num" value={state.prefMultiple} onChange={on('prefMultiple')} hint="Zx" />
          <NumberField label="Senior pref" value={state.seniorPref} onChange={on('seniorPref')} hint="ahead of you" />
          <NumberField label="Pari passu pref" value={state.pariPref} onChange={on('pariPref')} hint="alongside" />
        </div>
        <div className="toggles">
          <Toggle label="Participating" checked={state.participating} onChange={on('participating')} />
          {state.participating && <Toggle label="Capped" checked={state.capped} onChange={on('capped')} />}
        </div>
        {state.participating && state.capped && (
          <div className="grid">
            <NumberField label="Cap" kind="num" value={state.capMultiple} onChange={on('capMultiple')} hint="× invested" />
          </div>
        )}
        <Result label="Preference ahead of common" r={s.prefStack} fmt={fmtUSD} />
      </Section>

      <Section title="Dilution">
        {s.trail.steps.map((step, n) => {
          const round = state.rounds[n]
          return (
            <div className="round" key={round.id}>
              <div className="round-head">
                <input
                  className="round-label"
                  aria-label="Round name"
                  value={round.label}
                  onChange={(e) => setRound(round.id, { label: e.target.value })}
                />
                <span className="round-own">
                  {fmtPct(step.before)} → <strong>{fmtPct(step.after)}</strong>
                </span>
                <button type="button" className="drop" onClick={() => dropRound(round.id)} aria-label={`Remove ${round.label}`}>
                  ×
                </button>
              </div>
              <Segmented
                label=""
                ariaLabel={`${round.label} pricing`}
                value={round.mode}
                onChange={(v) => setRound(round.id, { mode: v })}
                options={[
                  { value: 'dilution', label: 'Dilution %' },
                  { value: 'round', label: 'Round size' },
                ]}
              />
              <div className="grid">
                {round.mode === 'dilution' ? (
                  <NumberField
                    label="Dilution"
                    kind="pct"
                    value={round.dilution}
                    onChange={(v) => setRound(round.id, { dilution: v })}
                  />
                ) : (
                  <>
                    <NumberField
                      label="Round size"
                      value={round.roundSize}
                      onChange={(v) => setRound(round.id, { roundSize: v })}
                    />
                    <NumberField
                      label="Post-money"
                      value={round.post}
                      onChange={(v) => setRound(round.id, { post: v })}
                    />
                    <NumberField
                      label="Your pro-rata"
                      value={round.proRata}
                      onChange={(v) => setRound(round.id, { proRata: v })}
                    />
                  </>
                )}
                <NumberField
                  label="Pool refresh"
                  kind="pct"
                  value={round.poolPct}
                  onChange={(v) => setRound(round.id, { poolPct: v })}
                />
              </div>
              {step.sourceFormula && (
                <Formula label={`${round.label} dilution`} text={step.sourceFormula} value={step.dilution} />
              )}
              <Formula label={`${round.label} ownership`} text={step.formula} value={step.after} />
            </div>
          )
        })}
        <button type="button" className="add" onClick={addRound}>
          + Add a round
        </button>
        <Result big label="Ownership at exit" r={s.ownFinalResult} fmt={fmtPct} />
        <Result label="Total invested" r={s.investedResult} fmt={fmtUSD} />
      </Section>

      <Section title="Outcomes">
        <div className="grid">
          <NumberField label="Years to exit" kind="num" value={state.yearsToExit} onChange={on('yearsToExit')} />
          <NumberField label="Target MOIC" kind="num" value={state.targetMoic} onChange={on('targetMoic')} />
        </div>
        <TextField
          label="Exit values"
          hint="comma separated, bare = $M"
          value={state.exitsText}
          onChange={on('exitsText')}
        />
        <OutcomeTable rows={s.rows} years={state.yearsToExit} />
        <p className="note">
          Rows shaded amber are governed by the liquidity preference rather than by common
          ownership. On conversion, senior and pari passu preferences are assumed to still take
          their money off the top.
        </p>
      </Section>

      <Section title="Key thresholds">
        <Result big label="Breakeven exit" r={s.breakeven} fmt={fmtUSD} />
        <Result label="Pref → common crossover" r={s.conversion} fmt={fmtUSD} />
        <Result label={`Exit for ${fmtX(state.targetMoic)}`} r={s.targetExit} fmt={fmtUSD} />
        <Result
          tone="warn"
          label="Exit that returns the fund"
          value={fmtUSD(returnerExit)}
          rawValue={returnerExit}
          formula={`smallest exit paying you the ${fmtUSD(fundSize)} fund back at ${fmtPct(s.ownFinal)} → ${fmtUSD(returnerExit)}`}
        />
      </Section>

      <button type="button" className="reset" onClick={reset}>
        Reset company to defaults
      </button>
    </>
  )
}
