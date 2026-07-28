import { useCalc } from './CalcContext.js'

/**
 * Every formula line is a button that sends itself to the Calc page. It stays
 * a plain <div> when no calculator is mounted, so the components remain
 * usable on their own.
 */
export function Formula({ label, text, value, className = 'formula' }) {
  const calc = useCalc()
  if (!text) return null
  if (!calc) return <div className={className}>{text}</div>
  return (
    <button
      type="button"
      className={`${className} formula-tap`}
      onClick={() => calc.send(label, text, value)}
      title="Show this in the calculator"
    >
      {text}
    </button>
  )
}

/**
 * Pass a `{ v, f }` result straight through with `r` plus the formatter for
 * its units; the raw value rides along so the calculator can check its own
 * reading of the formula against it. `value`/`formula` remain available for
 * the handful of results assembled inline.
 */
export default function Result({ label, r, fmt, value, formula, rawValue, big, tone }) {
  const shown = r ? (fmt || String)(r.v) : value
  const text = r ? r.f : formula
  const raw = r ? r.v : rawValue
  return (
    <div className={`result${big ? ' result-big' : ''}${tone ? ` tone-${tone}` : ''}`}>
      <div className="result-head">
        <span className="result-label">{label}</span>
        <span className="result-value">{shown}</span>
      </div>
      <Formula label={label} text={text} value={raw} />
    </div>
  )
}

export function Section({ title, children, open = true, note }) {
  return (
    <details className="section" open={open}>
      <summary>
        {title}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="section-body">{children}</div>
      {note && <p className="note">{note}</p>}
    </details>
  )
}

export function Summary({ items }) {
  return (
    <div className="summary">
      {items.map((it) => (
        <div key={it.label} className="summary-cell">
          <span className="summary-label">{it.label}</span>
          <span className="summary-value">{it.value}</span>
        </div>
      ))}
    </div>
  )
}
