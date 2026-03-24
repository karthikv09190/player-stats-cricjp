import { useState, useEffect } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL as string) || ''
const DEFAULT_COOKIE = (import.meta.env.VITE_CC_COOKIE as string) || ''

interface FormatRow { [key: string]: string }
interface Stats {
  name?: string
  batting?: FormatRow[]
  bowling?: FormatRow[]
}

const S: Record<string, React.CSSProperties> = {
  body: { margin: 0, minHeight: '100vh', background: '#081c0f', color: '#f0f4f1', fontFamily: 'Inter, sans-serif', WebkitFontSmoothing: 'antialiased' },
  header: { background: 'linear-gradient(135deg,#081c0f,#163824)', borderBottom: '2px solid #1a5c2e', padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' },
  logo: { fontFamily: 'Oswald,sans-serif', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.06em' },
  main: { maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' },
  card: { background: '#0f2d1a', border: '1px solid #1a5c2e', borderRadius: 14, padding: '1.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a8c0b0', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' } as React.CSSProperties,
  input: { width: '100%', boxSizing: 'border-box' as const, background: '#163824', border: '1px solid #237a3d', borderRadius: 8, color: '#f0f4f1', padding: '0.65rem 0.9rem', fontSize: '0.95rem', outline: 'none' },
  btnPrimary: { background: '#237a3d', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.6rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' },
}

const BAT_COLS = ['series type', 'mat', 'inns', 'no', 'runs', 'balls', 'ave', 'sr', 'hs', '100s', '50s', '4s', '6s']
const BOWL_COLS = ['series type', 'mat', 'inns', 'overs', 'runs', 'wkts', 'ave', 'econ', 'sr', '4w', '5w']
const COL_LABELS: Record<string, string> = {
  'series type': 'Format', mat: 'Mat', inns: 'Inns', no: 'NO', runs: 'Runs',
  balls: 'Balls', ave: 'Avg', sr: 'SR', hs: 'HS', '100s': '100s', '50s': '50s',
  '4s': '4s', '6s': '6s', overs: 'Overs', wkts: 'Wkts', econ: 'Econ', '4w': '4W', '5w': '5W',
}

function StatsTable({ rows, cols, accent }: { rows: FormatRow[]; cols: string[]; accent: string }) {
  const activeCols = cols.filter(c => rows.some(r => r[c] && r[c] !== '0'))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            {activeCols.map(c => (
              <th key={c} style={{ padding: '0.5rem 0.6rem', textAlign: c === 'series type' ? 'left' : 'right', color: '#a8c0b0', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${accent}44`, whiteSpace: 'nowrap' }}>
                {COL_LABELS[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {activeCols.map(c => (
                <td key={c} style={{ padding: '0.55rem 0.6rem', textAlign: c === 'series type' ? 'left' : 'right', color: c === 'series type' ? '#f0c040' : c === 'runs' || c === 'wkts' ? accent : '#f0f4f1', fontWeight: c === 'runs' || c === 'wkts' ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {row[c] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function App({ embedded }: { embedded?: boolean } = {}) {
  const [league, setLeague] = useState(() => localStorage.getItem('cc_league') || 'cricketorjp')
  const [clubId, setClubId] = useState(() => localStorage.getItem('cc_clubId') || '21278')
  const [showLeagueSettings, setShowLeagueSettings] = useState(false)

  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const cookie = DEFAULT_COOKIE
  const [dragOver, setDragOver] = useState(false)
  const [playerImage, setPlayerImage] = useState<string | null>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noStats, setNoStats] = useState(false)

  useEffect(() => { localStorage.setItem('cc_league', league) }, [league])
  useEffect(() => { localStorage.setItem('cc_clubId', clubId) }, [clubId])

  function handleImageUpload(file: File) {
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
    const id = nameWithoutExt.trim()
    if (id) {
      setPlayerId(id)
      setError('')
    }
    setPlayerImage(URL.createObjectURL(file))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageUpload(file)
  }

  async function fetchStats() {
    if (!playerId.trim()) { setError('Please enter a Player ID.'); return }
    setLoading(true); setError(''); setStats(null); setNoStats(false)

    const url = `https://cricclubs.com/${league.trim()}/viewPlayer.do?playerId=${playerId.trim()}&clubId=${clubId.trim()}`

    try {
      const params = new URLSearchParams({ url })
      if (cookie.trim()) params.set('cookie', cookie.trim())
      const res = await fetch(`${API_BASE}/api/stats?${params}`)
      const text = await res.text()
      let data: { stats?: Stats; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error('Server returned an unexpected response. Cloudflare may be blocking the request.') }
      if (!res.ok) throw new Error(data.error || 'Server error')
      const s: Stats = data.stats || {}
      if (!s.batting?.length && !s.bowling?.length) setNoStats(true)
      else setStats(s)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
        setError(`Cannot reach the backend at ${API_BASE}. Make sure the Render service is running and awake.`)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const totalRuns = stats?.batting?.reduce((s, r) => s + (parseInt(r['runs']) || 0), 0) ?? 0
  const totalWkts = stats?.bowling?.reduce((s, r) => s + (parseInt(r['wkts']) || 0), 0) ?? 0

  const inner = (
    <>
      {/* League settings */}
      <div style={{ ...S.card, marginBottom: '1rem', padding: '0.9rem 1.2rem' }}>
        <div
          onClick={() => setShowLeagueSettings(v => !v)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '0.8rem', color: '#a8c0b0' }}>
            ⚙️ League: <strong style={{ color: '#3ec96a' }}>{league}</strong>
            <span style={{ marginLeft: 8, color: '#a8c0b0' }}>· Club ID: <strong style={{ color: '#3ec96a' }}>{clubId}</strong></span>
          </div>
          <span style={{ color: '#a8c0b0', fontSize: '0.75rem' }}>{showLeagueSettings ? '▲ hide' : '▼ change'}</span>
        </div>
        {showLeagueSettings && (
          <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={S.label}>League (URL slug)</label>
              <input style={S.input} value={league} onChange={e => setLeague(e.target.value)} placeholder="e.g. cricketorjp" />
            </div>
            <div>
              <label style={S.label}>Club ID</label>
              <input style={S.input} value={clubId} onChange={e => setClubId(e.target.value)} placeholder="e.g. 21278" />
            </div>
          </div>
        )}
      </div>

      {/* Main input card */}
      <div style={{ ...S.card, marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={S.label}>Player Name <span style={{ color: '#a8c0b0', fontWeight: 400, textTransform: 'none' }}>(label only)</span></label>
            <input style={S.input} placeholder="e.g. Karthik Vellingiri" value={playerName} onChange={e => setPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && fetchStats()} />
          </div>
          <div>
            <label style={S.label}>Player ID</label>
            <input style={S.input} placeholder="e.g. 1984014" value={playerId} onChange={e => setPlayerId(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && fetchStats()} />
          </div>
        </div>

        {/* Image upload */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('img-upload')?.click()}
          style={{ marginBottom: '1rem', border: `2px dashed ${dragOver ? '#3ec96a' : '#1a5c2e'}`, borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: dragOver ? 'rgba(62,201,106,0.05)' : 'transparent', transition: 'all 0.15s' }}
        >
          <span style={{ fontSize: '1.2rem' }}>🖼️</span>
          <span style={{ fontSize: '0.8rem', color: '#a8c0b0' }}>
            Drop or click to upload an image — <strong style={{ color: '#3ec96a' }}>filename = Player ID</strong>
            {playerId && <span style={{ color: '#f0c040', marginLeft: 6 }}>→ ID set to <strong>{playerId}</strong></span>}
          </span>
          <input id="img-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
        </div>

        <div style={{ fontSize: '0.72rem', color: '#a8c0b0', marginBottom: '1rem', background: '#163824', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
          🔗 Will fetch: <code style={{ color: '#3ec96a' }}>cricclubs.com/{league}/viewPlayer.do?playerId={playerId || '...'}&clubId={clubId}</code>
        </div>

<div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }} onClick={fetchStats} disabled={loading}>
            {loading ? '⏳' : '🔍'} {loading ? 'Fetching... (~10s)' : 'Fetch Stats'}
          </button>
          {stats && (
            <button style={{ ...S.btnPrimary, background: 'transparent', border: '1px solid #237a3d', color: '#a8c0b0' }}
              onClick={() => { setStats(null); setPlayerName(''); setPlayerId('') }}>
              Clear
            </button>
          )}
        </div>

        {error && (
          <div style={{ marginTop: '1rem', background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '0.85rem 1rem', color: '#e05555', fontSize: '0.85rem', lineHeight: 1.5 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {noStats && !loading && (
        <div style={{ ...S.card, textAlign: 'center', padding: '2rem 1rem', border: '1px solid rgba(240,192,64,0.2)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤔</div>
          <div style={{ color: '#f0c040', fontWeight: 600 }}>No stats found — check the Player ID or Club ID.</div>
        </div>
      )}

      {stats && (
        <div>
          {/* Player header */}
          <div style={{ ...S.card, marginBottom: '1rem', background: 'linear-gradient(135deg,#163824,#0f2d1a)', border: '1px solid #237a3d', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#237a3d,#163824)', border: '2px solid #f0c040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden' }}>
              {playerImage ? <img src={playerImage} alt="player" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏏'}
            </div>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1.6rem', color: '#f0c040', flex: 1 }}>
              {playerName || stats.name}
            </div>
            <div style={{ display: 'flex', gap: '1.2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#4a9edd' }}>{totalRuns}</div>
                <div style={{ fontSize: '0.65rem', color: '#a8c0b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runs</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#e05555' }}>{totalWkts}</div>
                <div style={{ fontSize: '0.65rem', color: '#a8c0b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wkts</div>
              </div>
            </div>
          </div>

          {stats.batting && stats.batting.length > 0 && (
            <div style={{ ...S.card, marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4a9edd', marginBottom: '1rem' }}>🏏 Batting</div>
              <StatsTable rows={stats.batting} cols={BAT_COLS} accent="#4a9edd" />
            </div>
          )}

          {stats.bowling && stats.bowling.length > 0 && (
            <div style={{ ...S.card, marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#e05555', marginBottom: '1rem' }}>⚾ Bowling</div>
              <StatsTable rows={stats.bowling} cols={BOWL_COLS} accent="#e05555" />
            </div>
          )}
        </div>
      )}

      {!stats && !loading && !noStats && !error && (
        <div style={{ ...S.card, textAlign: 'center', padding: '3rem 1rem', border: '1px dashed #1a5c2e' }}>
          <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '0.75rem' }}>📊</div>
          <div style={{ color: '#a8c0b0' }}>Enter a Player Name and Player ID above, then hit Fetch Stats.</div>
        </div>
      )}
    </>
  )

  if (embedded) return <div>{inner}</div>

  return (
    <div style={S.body}>
      <div style={S.header}>
        <div style={{ fontSize: '1.8rem' }}>🏏</div>
        <div>
          <div style={S.logo}>
            <span style={{ color: '#f0c040' }}>CRIC</span>
            <span style={{ color: '#3ec96a' }}>CLUBS</span>
            <span style={{ color: '#a8c0b0', fontSize: '1rem', fontWeight: 400, marginLeft: 8 }}>Stats Fetcher</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a8c0b0', letterSpacing: '0.1em' }}>NO API KEY REQUIRED</div>
        </div>
      </div>

      <div style={S.main}>{inner}</div>

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
