import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'
import { readJournal, writeJournal, createJournal, splitRow, listJournalEntriesFull } from '../lib/journalStorage'

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

  // Initial load — single round-trip fetches every entry's metadata AND
  // content. No cascade of list → create → read. Today's row is NOT
  // auto-created on mount; if missing, we surface an empty editor and the
  // upsert happens on the first keystroke (debounced save handles it).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { pointers: list, contents: all } = await listJournalEntriesFull(user.id)
      if (cancelled) return
      const today = ymd(new Date())
      // Prepend a synthetic "today" pointer if no row exists yet, so the
      // editor renders immediately on a clean account.
      const hasToday = list.some(p => p.date === today)
      const finalList = hasToday ? list : [{ user_id: user.id, date: today, updated_at: null }, ...list]
      const finalContents = hasToday ? all : { ...all, [today]: { did: '', plan: '', mood: '' } }
      setPointers(finalList)
      setContents(finalContents)
      setActiveDate(finalList[0]?.date ?? null)
    })().catch(console.error)
    return () => { cancelled = true }
  }, [user])

  // Realtime: pointers INSERT (new entry created elsewhere) + UPDATE (content changed elsewhere).
  useEffect(() => {
    if (!user) return
    const userFilter = `user_id=eq.${user.id}`
    const ch = supabase.channel(`journal-entries-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_entries', filter: userFilter },
        ({ new: row }) => {
          const { pointer, content } = splitRow(row)
          setPointers(prev => {
            if (prev.some(p => p.date === pointer.date)) return prev
            return [pointer, ...prev].sort((a, b) => b.date.localeCompare(a.date))
          })
          setContents(prev => prev[pointer.date] !== undefined ? prev : { ...prev, [pointer.date]: content })
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'journal_entries', filter: userFilter },
        ({ new: row }) => {
          const { pointer, content } = splitRow(row)
          // Skip our own echoes.
          if (lastWrittenAtRef.current[pointer.date] === pointer.updated_at) return
          // If the user is actively typing on this date, defer — applying now
          // would overwrite their in-flight characters.
          const lastTyped = lastTypedAtRef.current[pointer.date] || 0
          if (Date.now() - lastTyped < 3000) return
          setContents(prev => ({ ...prev, [pointer.date]: content }))
          setPointers(prev => prev.map(p => p.date === pointer.date ? pointer : p))
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'journal_entries', filter: userFilter },
        ({ old: row }) => {
          const date = row.entry_date
          setPointers(prev => prev.filter(p => p.date !== date))
          setContents(prev => { const next = { ...prev }; delete next[date]; return next })
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

  // Optimistic render: if active content not loaded yet, surface an empty
  // shell so the editor is interactive immediately. Real content (if any)
  // replaces this once the initial fetch resolves.
  const today = ymd(new Date())
  const fallbackDate = activeDate ?? today
  const active = contents[fallbackDate]
    ? { date: fallbackDate, ...contents[fallbackDate] }
    : { date: fallbackDate, did: '', plan: '', mood: '' }

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
          <div className="editor-meta">
            <span className="eyebrow">{fmtEntryDate(active.date)}</span>
            <span className="muted small">autosaved · synced across devices</span>
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
        </section>
      </div>
    </div>
  )
}

function PlusIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
}
