import { useState, useRef } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL as string) || ''
const DEFAULT_COOKIE = (import.meta.env.VITE_CC_COOKIE as string) || ''

interface Player {
  id: string
  imageUrl: string
  name: string
  status: 'idle' | 'loading' | 'done' | 'error'
  runs: number
  wkts: number
}

function getLeague() { return localStorage.getItem('cc_league') || 'cricketorjp' }
function getClubId() { return localStorage.getItem('cc_clubId') || '21278' }

function PlayerCard({ p, num }: { p: Player; num: number }) {
  const borderColor = p.status === 'done' ? '#c8a84b' : p.status === 'loading' ? '#f0c040' : '#2255aa'
  return (
    <div style={{ background: 'linear-gradient(170deg,#1a3a7a 0%,#0d1e4a 60%,#0a1530 100%)', border: `2px solid ${borderColor}`, borderRadius: 10, padding: '0.5rem 0.5rem 0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      {/* Number badge */}
      <div style={{ position: 'absolute', top: 6, left: 6, background: '#cc2233', color: '#fff', fontFamily: 'Oswald,sans-serif', fontWeight: 700, fontSize: '0.85rem', width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>{num}</div>

      {/* Photo */}
      <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid #c8a84b', background: '#1a3a7a', margin: '0.3rem 0 0.5rem', flexShrink: 0, position: 'relative' }}>
        {p.status === 'loading'
          ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', background: '#0d1e4a' }}>⏳</div>
          : <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }
      </div>

      {/* Name */}
      <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2, marginBottom: '0.4rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {p.name}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.3rem', width: '100%' }}>
        <div style={{ flex: 1, background: 'rgba(74,158,221,0.25)', borderRadius: 5, padding: '0.25rem 0', textAlign: 'center', border: '1px solid rgba(74,158,221,0.4)' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#4a9edd', lineHeight: 1 }}>
            {p.status === 'done' ? p.runs : '–'}
          </div>
          <div style={{ fontSize: '0.48rem', color: '#a8c0b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runs</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(224,85,85,0.25)', borderRadius: 5, padding: '0.25rem 0', textAlign: 'center', border: '1px solid rgba(224,85,85,0.4)' }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#e05555', lineHeight: 1 }}>
            {p.status === 'done' ? p.wkts : '–'}
          </div>
          <div style={{ fontSize: '0.48rem', color: '#a8c0b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wkts</div>
        </div>
      </div>
    </div>
  )
}

export default function Team() {
  const [players, setPlayers] = useState<Player[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [venue, setVenue] = useState('')
  const cookie = DEFAULT_COOKIE
  const [showLineup, setShowLineup] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const incoming: Player[] = []
    for (let i = 0; i < files.length && players.length + incoming.length < 11; i++) {
      const file = files[i]
      const id = file.name.replace(/\.[^.]+$/, '').trim()
      if (!id || players.some(p => p.id === id)) continue
      incoming.push({ id, imageUrl: URL.createObjectURL(file), name: id, status: 'idle', runs: 0, wkts: 0 })
    }
    setPlayers(prev => [...prev, ...incoming])
  }

  function removePlayer(id: string) {
    setPlayers(prev => prev.filter(p => p.id !== id))
  }

  async function fetchAll() {
    if (players.length === 0) return
    setFetching(true)
    setShowLineup(false)
    const league = getLeague()
    const clubId = getClubId()

    for (const p of players) {
      setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, status: 'loading' } : x))
      try {
        const url = `https://cricclubs.com/${league}/viewPlayer.do?playerId=${p.id}&clubId=${clubId}`
        const params = new URLSearchParams({ url })
        if (cookie.trim()) params.set('cookie', cookie.trim())
        const res = await fetch(`${API_BASE}/api/stats?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
        const s = data.stats || {}
        const runs = (s.batting || []).reduce((a: number, r: Record<string, string>) => a + (parseInt(r['runs']) || 0), 0)
        const wkts = (s.bowling || []).reduce((a: number, r: Record<string, string>) => a + (parseInt(r['wkts']) || 0), 0)
        setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, status: 'done', runs, wkts, name: s.name || p.id } : x))
      } catch (err) {
        console.error(`Error fetching player ${p.id}:`, err)
        setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, status: 'error' } : x))
      }
    }

    setFetching(false)
    setShowLineup(true)
  }

  const row1 = players.slice(0, 6)
  const row2 = players.slice(6, 11)

  const inputStyle: React.CSSProperties = { background: '#163824', border: '1px solid #237a3d', borderRadius: 6, color: '#f0f4f1', padding: '0.5rem 0.75rem', fontSize: '0.82rem', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div>
      {/* Setup card */}
      <div style={{ background: '#0f2d1a', border: '1px solid #1a5c2e', borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        {/* Match details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.2rem' }}>
          {[['Team A Name', teamA, setTeamA], ['Team B Name', teamB, setTeamB], ['Date', matchDate, setMatchDate], ['Venue', venue, setVenue]].map(([label, val, set]) => (
            <div key={label as string}>
              <div style={{ fontSize: '0.68rem', color: '#a8c0b0', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>{label as string}</div>
              <input style={inputStyle} value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)} placeholder={label as string} />
            </div>
          ))}
        </div>

        {/* Upload */}
        <div style={{ fontSize: '0.8rem', color: '#a8c0b0', marginBottom: '0.75rem' }}>
          Upload up to <strong style={{ color: '#f0c040' }}>11 player images</strong> — filename = Player ID &nbsp;·&nbsp;
          <span style={{ color: '#3ec96a' }}>{players.length}/11 added</span>
        </div>

        {players.length < 11 && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? '#3ec96a' : '#1a5c2e'}`, borderRadius: 8, padding: '0.9rem', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(62,201,106,0.05)' : 'transparent', marginBottom: '0.9rem', transition: 'all 0.15s' }}
          >
            <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>🖼️</div>
            <div style={{ fontSize: '0.78rem', color: '#a8c0b0' }}>Drop images here or click to select</div>
            <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          </div>
        )}

        {/* Thumbnail strip */}
        {players.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
            {players.map(p => (
              <div key={p.id} style={{ position: 'relative' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${p.status === 'done' ? '#3ec96a' : p.status === 'error' ? '#e05555' : p.status === 'loading' ? '#f0c040' : '#237a3d'}` }}>
                  <img src={p.imageUrl} alt={p.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                {!fetching && (
                  <button onClick={() => removePlayer(p.id)} style={{ position: 'absolute', top: -3, right: -3, background: '#e05555', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', color: '#fff', fontSize: '0.5rem', lineHeight: '14px', padding: 0 }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

<div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchAll} disabled={fetching || players.length === 0} style={{ background: '#237a3d', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem', fontSize: '0.9rem', fontWeight: 600, cursor: players.length === 0 || fetching ? 'not-allowed' : 'pointer', opacity: players.length === 0 || fetching ? 0.5 : 1 }}>
            {fetching ? '⏳ Fetching...' : '📊 Fetch All Stats'}
          </button>
          {players.length > 0 && !fetching && (
            <button onClick={() => { setPlayers([]); setShowLineup(false) }} style={{ background: 'transparent', color: '#a8c0b0', border: '1px solid #237a3d', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>Clear All</button>
          )}
        </div>
      </div>

      {/* Playing XI Board */}
      {(showLineup || players.some(p => p.status !== 'idle')) && players.length > 0 && (
        <div style={{ background: 'linear-gradient(180deg,#0a1228 0%,#0d1a3a 40%,#081530 100%)', borderRadius: 16, padding: '1.5rem 1.2rem 1.8rem', border: '2px solid #1a3a7a', boxShadow: '0 8px 40px rgba(0,0,0,0.7)', position: 'relative', overflow: 'hidden' }}>
          {/* Stadium glow */}
          <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 3, background: 'linear-gradient(90deg,transparent,#c8a84b,transparent)', borderRadius: 2 }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#cc2233', fontSize: '1.6rem' }}>‖</span>
              <span style={{ WebkitTextStroke: '1px #c8a84b', color: '#fff' }}>PLAYING XI</span>
              <span style={{ color: '#cc2233', fontSize: '1.6rem' }}>‖</span>
            </div>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '0.8rem', color: '#a8c0b0', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '0.2rem' }}>Match Day Lineup</div>
            {(teamA || teamB) && (
              <div style={{ fontFamily: 'Oswald,sans-serif', fontSize: '1rem', color: '#f0c040', marginTop: '0.3rem', letterSpacing: '0.05em' }}>
                {teamA || 'Team A'} <span style={{ color: '#a8c0b0' }}>vs</span> {teamB || 'Team B'}
              </div>
            )}
            {(matchDate || venue) && (
              <div style={{ fontSize: '0.72rem', color: '#a8c0b0', marginTop: '0.2rem', letterSpacing: '0.08em' }}>
                {matchDate}{matchDate && venue ? '  ·  ' : ''}{venue}
              </div>
            )}
          </div>

          {/* Row 1 — 6 players */}
          {row1.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row1.length}, 1fr)`, gap: '0.6rem', marginBottom: '0.8rem' }}>
              {row1.map((p, i) => <PlayerCard key={p.id} p={p} num={i + 1} />)}
            </div>
          )}

          {/* Row 2 — 5 players centred */}
          {row2.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
              {row2.map((p, i) => (
                <div key={p.id} style={{ width: `calc((100% - ${(row1.length - 1) * 0.6}rem) / ${row1.length})`, minWidth: 0, maxWidth: 160 }}>
                  <PlayerCard p={p} num={row1.length + i + 1} />
                </div>
              ))}
            </div>
          )}

          {/* Bottom glow line */}
          <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, background: 'linear-gradient(90deg,transparent,#c8a84b,transparent)', borderRadius: 2 }} />
        </div>
      )}

      {players.length === 0 && (
        <div style={{ background: '#0f2d1a', border: '1px dashed #1a5c2e', borderRadius: 14, textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '0.75rem' }}>👥</div>
          <div style={{ color: '#a8c0b0' }}>Upload player images to build your Playing XI.</div>
        </div>
      )}
    </div>
  )
}
