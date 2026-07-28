import { useCallback, useEffect, useMemo, useState } from 'react'
import FundPage from './pages/FundPage.jsx'
import StartupPage from './pages/StartupPage.jsx'
import CalcPage, { makeWork } from './pages/CalcPage.jsx'
import { CalcContext } from './components/CalcContext.js'
import { FUND_DEFAULTS } from './lib/fund.js'
import { STARTUP_DEFAULTS } from './lib/startup.js'

const KEY = 'vm.state.v1'
const CALC_DEFAULTS = { expr: '', tape: [] }
const TABS = [
  { id: 'fund', label: 'Fund', title: 'Fund', sub: 'fees · investable · fund returners' },
  { id: 'startup', label: 'Company', title: 'Company', sub: 'entry · pref · dilution · exit' },
  { id: 'calc', label: 'Calc', title: 'Calculator', sub: 'tap any formula to show the work' },
]

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      // Merge over defaults so a new input added later shows up with a
      // sensible value instead of undefined.
      fund: { ...FUND_DEFAULTS, ...(saved.fund || {}) },
      startup: { ...STARTUP_DEFAULTS, ...(saved.startup || {}) },
      calc: { ...CALC_DEFAULTS, ...(saved.calc || {}) },
    }
  } catch {
    return { fund: { ...FUND_DEFAULTS }, startup: { ...STARTUP_DEFAULTS }, calc: { ...CALC_DEFAULTS } }
  }
}

function tabFromHash() {
  const t = window.location.hash.replace(/^#\/?/, '')
  return TABS.some((x) => x.id === t) ? t : 'fund'
}

export default function App() {
  const [state, setState] = useState(load)
  const [tab, setTab] = useState(tabFromHash)
  const [work, setWork] = useState(null)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((t) => {
    window.location.hash = `#/${t}`
    setTab(t)
    window.scrollTo({ top: 0 })
  }, [])

  const slice = (name, defaults) => ({
    set: (patch) => setState((s) => ({ ...s, [name]: { ...s[name], ...patch } })),
    reset: () => setState((s) => ({ ...s, [name]: { ...defaults } })),
  })

  const fund = useMemo(() => slice('fund', FUND_DEFAULTS), [])
  const startup = useMemo(() => slice('startup', STARTUP_DEFAULTS), [])
  const calc = useMemo(() => slice('calc', CALC_DEFAULTS), [])

  // Tapping a formula anywhere sends it here, then jumps to the calculator.
  // `at` is a counter rather than a clock so repeat taps on the same formula
  // still register as a fresh hand-off.
  const send = useCallback(
    (label, formula, value) => {
      setWork((prev) => makeWork(label, formula, value, (prev?.at || 0) + 1))
      go('calc')
    },
    [go],
  )
  const calcApi = useMemo(() => ({ send }), [send])

  const active = TABS.find((t) => t.id === tab) || TABS[0]

  return (
    <CalcContext.Provider value={calcApi}>
      <div className="app">
        <header className="topbar">
          <h1>{active.title}</h1>
          <span className="sub">{active.sub}</span>
        </header>

        <main>
          {tab === 'fund' && <FundPage state={state.fund} set={fund.set} reset={fund.reset} />}
          {tab === 'startup' && (
            <StartupPage
              state={state.startup}
              set={startup.set}
              reset={startup.reset}
              fundSize={state.fund.fundSize}
            />
          )}
          {tab === 'calc' && (
            <CalcPage
              state={state.calc}
              set={calc.set}
              work={work}
              clearWork={() => setWork(null)}
            />
          )}
        </main>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === tab ? 'on' : ''}
              aria-current={t.id === tab ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </CalcContext.Provider>
  )
}
