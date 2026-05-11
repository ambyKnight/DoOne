import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'

const ymd = d => d.toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function fmtEntryDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function JournalPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [activeId, setActiveId] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!user) return
    const today = ymd(new Date())
    // Create today's entry if it doesn't exist, then load all for this user.
    supabase.from('journal_entries')
      .upsert(
        { date: today, did: '', plan: '', mood: '', user_id: user.id },
        { onConflict: 'user_id,date', ignoreDuplicates: true }
      )
      .then(() => {
        supabase.from('journal_entries').select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .then(({ data }) => {
            if (data) {
              setEntries(data)
              setActiveId(data[0]?.id ?? null)
            }
          })
      })

    // NOTE: no UPDATE listener. Postgres realtime echoes our own writes back,
    // and the latency means the echoed row is stale — applying it overwrites
    // characters the user typed during the roundtrip, looking like text
    // randomly deletes itself. INSERT is safe to keep (new entries elsewhere).
    const userFilter = `user_id=eq.${user.id}`
    const channel = supabase.channel(`journal-realtime-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_entries', filter: userFilter },
        ({ new: row }) => setEntries(prev => {
          if (prev.some(e => e.id === row.id)) return prev
          return [row, ...prev].sort((a, b) => b.date.localeCompare(a.date))
        })
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  const active = entries.find(e => e.id === activeId) || entries[0]

  function updateField(field, value) {
    // Optimistic local update
    setEntries(prev => prev.map(e => e.id === active.id ? { ...e, [field]: value } : e))
    // Debounced save
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('journal_entries').update({ [field]: value }).eq('id', active.id)
    }, 800)
  }

  async function newEntry() {
    if (!user) return
    // Add entry for yesterday (or the next un-journaled day)
    const existingDates = new Set(entries.map(e => e.date))
    let d = new Date()
    d.setDate(d.getDate() - 1)
    while (existingDates.has(ymd(d))) d.setDate(d.getDate() - 1)
    const { data } = await supabase.from('journal_entries')
      .insert({ date: ymd(d), did: '', plan: '', mood: '', user_id: user.id })
      .select().single()
    if (data) { setEntries(prev => [data, ...prev]); setActiveId(data.id) }
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
            <span className="muted">{entries.length}</span>
          </div>
          <ul className="entry-list">
            {entries.map(e => (
              <li
                key={e.id}
                className={`entry-row ${e.id === activeId ? 'on' : ''}`}
                onClick={() => setActiveId(e.id)}
              >
                <div className="entry-date">
                  {e.date === today ? 'Today' : fmtEntryDate(e.date)}
                </div>
                <div className="entry-preview">
                  {e.did?.slice(0, 80) || (e.date === today ? "tap to start today's entry…" : '—')}
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
                <span className="muted small">autosaved</span>
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
