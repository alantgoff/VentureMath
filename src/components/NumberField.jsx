import { useEffect, useState } from 'react'
import { parseMoney, parseNum, parsePct } from '../lib/format.js'

const PARSERS = { money: parseMoney, pct: parsePct, num: parseNum }

// Round-trip a stored number back into something short and re-typeable:
// 400000000 → "400" (bare money is millions), 1.4e9 → "1.4b", 500000 → "500k".
function toText(value, kind) {
  if (value == null || !isFinite(value)) return ''
  const clean = (n) => String(+n.toFixed(6))
  if (kind === 'pct') return clean(value * 100)
  if (kind === 'num') return clean(value)
  const a = Math.abs(value)
  if (a === 0) return '0'
  if (a >= 1e9) return `${clean(value / 1e9)}b`
  if (a >= 1e6) return clean(value / 1e6)
  if (a >= 1e3) return `${clean(value / 1e3)}k`
  return `${clean(value)}`
}

export default function NumberField({ label, value, onChange, kind = 'money', hint, wide }) {
  const [text, setText] = useState(() => toText(value, kind))
  const [focused, setFocused] = useState(false)

  // Let outside changes (presets, reset, a derived field) flow in, but never
  // yank the text out from under a thumb that is mid-edit.
  useEffect(() => {
    if (!focused) setText(toText(value, kind))
  }, [value, kind, focused])

  const handle = (e) => {
    const next = e.target.value
    setText(next)
    const n = PARSERS[kind](next)
    if (isFinite(n)) onChange(n)
  }

  return (
    <label className={`field${wide ? ' field-wide' : ''}`}>
      <span className="field-label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="field-input">
        {kind === 'money' && <i className="affix">$</i>}
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          value={text}
          onChange={handle}
          onFocus={(e) => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={() => {
            setFocused(false)
            setText(toText(value, kind))
          }}
        />
        {kind === 'pct' && <i className="affix affix-end">%</i>}
      </span>
    </label>
  )
}

export function TextField({ label, value, onChange, hint }) {
  return (
    <label className="field field-wide">
      <span className="field-label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="field-input">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  )
}

export function Segmented({ label, value, options, onChange, ariaLabel }) {
  return (
    <div className="field field-wide">
      <span className="field-label">{label}</span>
      <div className="segmented" role="group" aria-label={ariaLabel || label || undefined}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="toggle-dot" />
      {label}
    </button>
  )
}
