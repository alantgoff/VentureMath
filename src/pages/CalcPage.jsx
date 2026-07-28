import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Result.jsx'
import { compute, extract, formatValue } from '../lib/expr.js'

const KEYS = [
  ['C', '(', ')', '⌫', '÷'],
  ['7', '8', '9', 'K', '×'],
  ['4', '5', '6', 'M', '−'],
  ['1', '2', '3', 'B', '+'],
  ['0', '.', '%', '='],
]

const WIDE = new Set(['='])
const OPERATORS = new Set(['÷', '×', '−', '+'])

export default function CalcPage({ state, set, work, clearWork }) {
  const [expr, setExpr] = useState(state.expr || '')

  // A formula tapped on another page arrives as `work`; load its arithmetic
  // so the very next thing you can do is change a number in it.
  useEffect(() => {
    if (work?.extracted?.expression) setExpr(work.extracted.expression)
  }, [work?.at])

  useEffect(() => {
    set({ expr })
  }, [expr])

  const live = useMemo(() => compute(expr), [expr])

  const press = (key) => {
    if (key === 'C') return setExpr('')
    // Drop the padding around an operator first, so backspace never costs a
    // press that visibly does nothing.
    if (key === '⌫') return setExpr((e) => e.replace(/\s+$/, '').slice(0, -1))
    if (key === '=') {
      const result = compute(expr)
      if (!result) return
      const shown = formatValue(result.value, result.money)
      set({ tape: [{ expr, value: shown }, ...(state.tape || [])].slice(0, 12) })
      // The result becomes the next expression, so answers can be chained.
      return setExpr(shown.replace('−', '-'))
    }
    if (OPERATORS.has(key)) return setExpr((e) => `${e.replace(/\s*[÷×−+]\s*$/, '')} ${key} `)
    setExpr((e) => e + key)
  }

  return (
    <>
      <div className="calc-display">
        <div className="calc-expr">{expr || <span className="calc-hint">type an expression</span>}</div>
        <div className="calc-value">{live ? formatValue(live.value, live.money) : ' '}</div>
      </div>

      {work && (
        <Section title="Show the work">
          <p className="calc-label">{work.label}</p>
          <p className="calc-source">{work.formula}</p>
          {work.extracted ? (
            <ol className="calc-steps">
              {work.extracted.steps.map((step, n) => (
                <li key={n}>{step.text}</li>
              ))}
            </ol>
          ) : (
            <p className="note">
              This one is solved by search rather than by a single expression, so there are no
              steps to replay — the statement above is the whole of it.
            </p>
          )}
          <button type="button" className="add" onClick={clearWork}>
            Clear
          </button>
        </Section>
      )}

      <div className="keypad">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            className={`key${WIDE.has(key) ? ' key-wide' : ''}${
              OPERATORS.has(key) ? ' key-op' : ''
            }${key === '=' ? ' key-eq' : ''}${'CK M B%()⌫'.includes(key) ? ' key-alt' : ''}`}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <Section title="Tape" open={true}>
        {state.tape?.length ? (
          <ul className="tape">
            {state.tape.map((entry, n) => (
              <li key={n}>
                <button type="button" onClick={() => setExpr(entry.expr)}>
                  <span className="tape-expr">{entry.expr}</span>
                  <span className="tape-value">{entry.value}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">
            Nothing yet. Press = to keep a line, or tap any formula on the Fund or Company page to
            send it here.
          </p>
        )}
      </Section>

      {state.tape?.length > 0 && (
        <button type="button" className="reset" onClick={() => set({ tape: [] })}>
          Clear tape
        </button>
      )}
    </>
  )
}

/** Bundle a tapped formula into what the Calc page needs to show its work. */
export function makeWork(label, formula, value, at) {
  return { label, formula, value, at, extracted: extract(formula, value) }
}
