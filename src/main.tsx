import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Team from './Team'

function Root() {
  const [tab, setTab] = useState<'player' | 'team'>('player')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.45rem 1.2rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    background: active ? '#237a3d' : 'transparent',
    color: active ? '#fff' : '#a8c0b0',
    letterSpacing: '0.04em',
  })

  return (
    <div style={{ margin: 0, minHeight: '100vh', background: '#081c0f', color: '#f0f4f1', fontFamily: 'Inter, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#081c0f,#163824)', borderBottom: '2px solid #1a5c2e', padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.8rem' }}>🏏</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.06em' }}>
            <span style={{ color: '#f0c040' }}>CRIC</span>
            <span style={{ color: '#3ec96a' }}>CLUBS</span>
            <span style={{ color: '#a8c0b0', fontSize: '1rem', fontWeight: 400, marginLeft: 8 }}>Stats Fetcher</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a8c0b0', letterSpacing: '0.1em' }}>NO API KEY REQUIRED</div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.3rem', background: '#0f2d1a', border: '1px solid #1a5c2e', borderRadius: 8, padding: '0.3rem' }}>
          <button style={tabStyle(tab === 'player')} onClick={() => setTab('player')}>Player Stats</button>
          <button style={tabStyle(tab === 'team')} onClick={() => setTab('team')}>Team Summary</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {tab === 'player' ? <App embedded /> : <Team />}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #3ec96a !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #081c0f; }
        ::-webkit-scrollbar-thumb { background: #1a5c2e; border-radius: 3px; }
      `}</style>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Root /></StrictMode>
)
