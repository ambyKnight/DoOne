'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabaseClient'
import { useAuth } from '../../src/lib/authContext'

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [tables, setTables] = useState([])
  const [active, setActive] = useState(null)
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [forbidden, setForbidden] = useState(false)

  async function token() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const t = await token()
      if (!t) return
      const r = await fetch('/api/admin/tables', { headers: { Authorization: `Bearer ${t}` } })
      if (r.status === 403) { setForbidden(true); return }
      const j = await r.json()
      setTables(j.tables || [])
      if (j.tables?.length && !active) setActive(j.tables[0].name)
    })()
  }, [user])

  useEffect(() => {
    if (!active || !user) return
    loadRows()
  }, [active, offset, user])

  async function loadRows() {
    setLoading(true)
    setError(null)
    setExpanded(null)
    try {
      const t = await token()
      const url = `/api/admin/table?table=${active}&limit=${limit}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setRows(j.rows)
      setCount(j.count)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function changeTable(name) {
    setActive(name); setOffset(0); setQ('')
  }

  if (authLoading) return <div style={{ padding: 40 }}>loading…</div>
  if (!user) return <div style={{ padding: 40 }}>sign in via the main app first, then return to /admin</div>
  if (forbidden) return <div style={{ padding: 40, color: '#e54e4e' }}>403 — your UID is not in ADMIN_UIDS.</div>

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-side-head">
          <h1>admin</h1>
          <a href="/" title="back to app">←</a>
        </div>
        <div className="admin-side-user">
          {user.email}<br/>
          <span style={{ color: '#444' }}>{user.id}</span>
        </div>
        <ul className="admin-table-list">
          {tables.map(t => (
            <li key={t.name}>
              <button
                className={active === t.name ? 'active' : ''}
                onClick={() => changeTable(t.name)}
              >
                <span>{t.name}</span>
                {!t.userScoped && <span className="count">global</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="admin-main">
        <div className="admin-bar">
          <h2>{active || '—'}</h2>
          <input
            type="text"
            placeholder="search…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setOffset(0); loadRows() } }}
          />
          <button onClick={() => { setOffset(0); loadRows() }} disabled={loading}>search</button>
          <button onClick={loadRows} disabled={loading}>refresh</button>
          <span className="stat">{loading ? 'loading…' : `${count} rows`}</span>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-rows">
          {!loading && rows.length === 0 && <div className="admin-empty">no rows</div>}
          {rows.map(r => {
            const isOpen = expanded === r.id
            const title = pickTitle(active, r)
            const meta = pickMeta(active, r)
            return (
              <div
                key={r.id}
                className="admin-row"
                onClick={() => setExpanded(isOpen ? null : r.id)}
              >
                <div className="admin-row-head">
                  <span className="admin-row-id" title={r.id}>{(r.id || '').slice(0,8)}</span>
                  <span className="admin-row-title">{title}</span>
                  <span className="admin-row-meta">{meta}</span>
                </div>
                {isOpen && (
                  <pre className="admin-row-expand">{JSON.stringify(r, null, 2)}</pre>
                )}
              </div>
            )
          })}
        </div>

        <div className="admin-pager">
          <span className="info">{offset + 1}–{Math.min(offset + rows.length, count)} of {count}</span>
          <button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>← prev</button>
          <button disabled={offset + limit >= count || loading} onClick={() => setOffset(offset + limit)}>next →</button>
        </div>
      </main>
    </div>
  )
}

function pickTitle(table, r) {
  switch (table) {
    case 'events':
    case 'tasks':
    case 'jobs':
    case 'sessions':
      return r.title
    case 'journal_entries':
      return `${r.entry_date}  ${(r.mood || '').slice(0,80)}`
    case 'ai_runs':
      return r.prompt?.slice(0,120) || '(no prompt)'
    case 'insights':
      return `${r.period_start} → ${r.period_end}`
    case 'behavior_memory':
      return `${r.pattern_type}  ${(r.summary_text || '').slice(0,80)}`
    case 'actions':
      return `${r.action} · ${r.target_type || ''}`
    case 'profiles':
      return r.username || r.id
    case 'user_preferences':
      return `${r.vibe || '—'} / ${r.surface || '—'} / ${r.density || '—'}`
    default: return ''
  }
}

function pickMeta(table, r) {
  switch (table) {
    case 'events':
      return `${(r.start_time || '').slice(0,16)} · ${r.tag || ''}`
    case 'tasks':
      return r.done ? '✓ done' : '○ open'
    case 'jobs':
      return `${r.status} · p${r.priority} · ${r.total_time}m`
    case 'sessions':
      return `${r.status} · ${r.duration}m · #${r.order_index}`
    case 'journal_entries':
      return `did:${r.did?.length||0}c plan:${r.plan?.length||0}c`
    case 'ai_runs':
      const tot = r.usage?.totalTokenCount ?? '—'
      return `${tot}tok · ${r.duration_ms}ms${r.error ? ' · ✗' : ''}`
    default:
      return r.created_at?.slice(0,16) || ''
  }
}
