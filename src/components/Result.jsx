export default function Result({ label, value, formula, big, tone }) {
  return (
    <div className={`result${big ? ' result-big' : ''}${tone ? ` tone-${tone}` : ''}`}>
      <div className="result-head">
        <span className="result-label">{label}</span>
        <span className="result-value">{value}</span>
      </div>
      {formula && <div className="formula">{formula}</div>}
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
