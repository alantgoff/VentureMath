import { useCallback, useEffect, useState } from 'react'
import FundPage from './pages/FundPage.jsx'
import StartupPage from './pages/StartupPage.jsx'
import { FUND_DEFAULTS } from './lib/fund.js'
import { STARTUP_DEFAULTS } from './lib/startup.js'

const KEY = 'vm.state.v1'
const TABS = ['fund', 'startup']

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      // Merge over defaults so a new input added later shows up with a
      // sensible value instead of undefined.
      fund: { ...FUND_DEFAULTS, ...(saved.fund || {}) },
      startup: { ...STARTUP_DEFAULTS, ...(saved.startup || {}) },
    }
  } catch {
    return { fund: { ...FUND_DEFAULTS }, startup: { ...STARTUP_DEFAULTS } }
  }
}

function tabFromHash() {
  const t = window.location.hash.replace(/^#\/?/, '')
  return TABS.includes(t) ? t : 'fund'
}

export default function App() {
  const [state, setState] = useState(load)
  const [tab, setTab] = useState(tabFromHash)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (t) => {
    window.location.hash = `#/${t}`
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  const setFund = useCallback((patch) => setState((s) => ({ ...s, fund: { ...s.fund, ...patch } })), [])
  const setStartup = useCallback(
    (patch) => setState((s) => ({ ...s, startup: { ...s.startup, ...patch } })),
    [],
  )
  const resetFund = useCallback(() => setState((s) => ({ ...s, fund: { ...FUND_DEFAULTS } })), [])
  const resetStartup = useCallback(
    () => setState((s) => ({ ...s, startup: { ...STARTUP_DEFAULTS } })),
    [],
  )

  return (
    <div className="app">
      <header className="topbar">
        <h1>{tab === 'fund' ? 'Fund' : 'Company'}</h1>
        <span className="sub">
          {tab === 'fund' ? 'fees · investable · fund returners' : 'entry · pref · dilution · exit'}
        </span>
      </header>

      <main>
        {tab === 'fund' ? (
          <FundPage state={state.fund} set={setFund} reset={resetFund} />
        ) : (
          <StartupPage
            state={state.startup}
            set={setStartup}
            reset={resetStartup}
            fundSize={state.fund.fundSize}
          />
        )}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={t === tab ? 'on' : ''} onClick={() => go(t)}>
            {t === 'fund' ? 'Fund' : 'Company'}
          </button>
        ))}
      </nav>
    </div>
  )
}
