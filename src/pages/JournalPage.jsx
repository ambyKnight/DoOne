import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'
import { readJournal, writeJournal, listJournalPointers, createJournal } from '../lib/journalStorage'

const ymd = d => d.toISOString().slice(0, 10)

function fmtEntryDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function JournalPage() {
  const { user } = useAuth()
  // `pointers` is the list of entry metadata (date + updated_at + storage_path).
  // `contents` is a per-date cache of the actual journal text fetched from storage.
  const [pointers, setPointers] = useState([])
  const [contents, setContents] = useState({})  // { date: { did, plan, mood } }
  const [activeDate, setActiveDate] = useState(null)
  const saveTimer = useRef(null)
  // Echo-guard: timestamp of the most recent write WE made for each date.
  // Realtime UPDATE events that match this timestamp are skipped.
  const lastWrittenAtRef = useRef({})
  // Track last keystroke time per date — used to avoid stomping the user's
  // in-progress typing with a remote UPDATE.
  const lastTypedAtRef = useRef({})

  // Initial load — fetch pointers, create today's entry if missing, fetch its content.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      let list = await listJournalPointers(user.id)
      const today = ymd(new Date())
      if (!list.some(p => p.date === today)) {
        const created = await createJournal(user.id, today)
        lastWrittenAtRef.current[today] = created.updated_at
        list = [created, ...list]
      }
      if (cancelled) return
      setPointers(list)
      setActiveDate(list[0]?.date ?? null)
      // Eager-fetch the first (active) entry's content
      if (list[0]) {
        const c = await readJournal(user.id, list[0].date)
        if (!cancelled) setContents(prev => ({ ...prev, [list[0].date]: c }))
      }
    })().catch(console.error)
    return () => { cancelled = true }
  }, [user])

  // Realtime: pointers INSERT (new entry created elsewhere) + UPDATE (content changed elsewhere).
  useEffect(() => {
    if (!user) return
    const userFilter = `user_id=eq.${user.id}`
    const ch = supabase.channel(`journal-pointers-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_pointers', filter: userFilter },
        ({ new: row }) => {
          setPointers(prev => {
            if (prev.some(p => p.date === row.date)) return prev
            return [row, ...prev].sort((a, b) => b.date.localeCompare(a.date))
          })
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'journal_pointers', filter: userFilter },
        async ({ new: row }) => {
          // Skip our own echoes.
          if (lastWrittenAtRef.current[row.date] === row.updated_at) return
          // If the user is actively typing on this date, defer — applying now
          // would overwrite their in-flight characters.
          const lastTyped = lastTypedAtRef.current[row.date] || 0
          if (Date.now() - lastTyped < 3000) return
          try {
            const c = await readJournal(user.id, row.date)
            setContents(prev => ({ ...prev, [row.date]: c }))
            setPointers(prev => prev.map(p => p.date === row.date ? row : p))
          } catch (e) { console.error(e) }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user])

  // Lazy-fetch content when active entry changes (if not cached yet).
  useEffect(() => {
    if (!user || !activeDate) return
    if (contents[activeDate] !== undefined) return
    let cancelled = false
    readJournal(user.id, activeDate).then(c => {
      if (!cancelled) setContents(prev => ({ ...prev, [activeDate]: c }))
    }).catch(console.error)
    return () => { cancelled = true }
  }, [user, activeDate, contents])

  const active = activeDate && contents[activeDate] ? { date: activeDate, ...contents[activeDate] } : null

  function updateField(field, value) {
    if (!active || !user) return
    const date = active.date
    lastTypedAtRef.current[date] = Date.now()
    // Optimistic local update
    setContents(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }))
    // Debounced save
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const next = { ...contents[date], [field]: value }
        const updated_at = await writeJournal(user.id, date, next)
        lastWrittenAtRef.current[date] = updated_at
        // Update pointer in local list so order stays consistent.
        setPointers(prev => prev.map(p => p.date === date ? { ...p, updated_at } : p))
      } catch (e) {
        console.error('[journal save]', e)
      }
    }, 800)
  }

  async function newEntry() {
    if (!user) return
    const existingDates = new Set(pointers.map(p => p.date))
    let d = new Date()
    d.setDate(d.getDate() - 1)
    while (existingDates.has(ymd(d))) d.setDate(d.getDate() - 1)
    const date = ymd(d)
    try {
      const created = await createJournal(user.id, date)
      lastWrittenAtRef.current[date] = created.updated_at
      setPointers(prev => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
      setContents(prev => ({ ...prev, [date]: { did: '', plan: '', mood: '' } }))
      setActiveDate(date)
    } catch (e) { console.error(e) }
  }

  const today = ymd(new Date())

  return (
    <div className="page journal-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">journal</div>
          <h1 className="page-title">
            {active?.date === today ? 'Today' : active ? fmtEntryDate(active.date) : 'Journal'}
          </h1>
        </div>
        <div className="header-tools">
          <button className="chip primary" onClick={newEntry}>
            <PlusIcon width="14" height="14" /> new entry
          </button>
        </div>
      </header>

      <div className="journal-grid">
        <aside className="panel glass journal-list">
          <div className="panel-head">
            <h3>Entries</h3>
            <span className="muted">{pointers.length}</span>
          </div>
          <ul className="entry-list">
            {pointers.map(p => (
              <li
                key={p.date}
                className={`entry-row ${p.date === activeDate ? 'on' : ''}`}
                onClick={() => setActiveDate(p.date)}
              >
                <div className="entry-date">
                  {p.date === today ? 'Today' : fmtEntryDate(p.date)}
                </div>
                <div className="entry-preview">
                  {contents[p.date]?.did?.slice(0, 80) || (p.date === today ? "tap to start today's entry…" : '—')}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel glass journal-editor">
          {active ? (
            <>
              <div className="editor-meta">
                <span className="eyebrow">{fmtEntryDate(active.date)}</span>
                <span className="muted small">autosaved · stored in files</span>
              </div>
              <div className="editor-field">
                <label className="field-label">What I did today</label>
                <textarea
                  placeholder="how the day went…"
                  value={active.did}
                  onChange={e => updateField('did', e.target.value)}
                  rows={4}
                />
              </div>
              <div className="editor-field">
                <label className="field-label">What I plan to do</label>
                <textarea
                  placeholder="next steps, tomorrow's intentions…"
                  value={active.plan}
                  onChange={e => updateField('plan', e.target.value)}
                  rows={4}
                />
              </div>
              <div className="editor-field">
                <label className="field-label">Mood · notes</label>
                <input
                  placeholder="one line — how are you feeling?"
                  value={active.mood}
                  onChange={e => updateField('mood', e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="muted" style={{ margin: 'auto' }}>Loading…</div>
          )}
        </section>
      </div>
    </div>
  )
}

function PlusIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
}
