import { useState } from 'react'
import MiniCalendar from '../components/MiniCalendar'
import EventFormModal from '../components/EventFormModal'
import AlgorithmicOrnament from '../components/AlgorithmicOrnament'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'

const fmtTime = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function todayDateStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function HomePage({ events, tasks, setTasks, isMobile, setPage }) {
  const { user } = useAuth()
  const now = new Date()
  const [newTask, setNewTask] = useState('')
  const [quickModal, setQuickModal] = useState(false)

  const todays = events
    .filter(e => !e.allDay && new Date(e.start).toDateString() === now.toDateString())
    .map(e => ({ ...e, _start: new Date(e.start), _end: new Date(e.end || e.start) }))
    .sort((a, b) => a._start - b._start)

  const next = todays.find(e => e._end > now) || todays[0]
  const minsUntil = next ? Math.max(0, Math.round((new Date(next.start) - now) / 60000)) : 0

  async function toggleTask(task) {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
  }

  async function deleteTask(e, task) {
    e.stopPropagation()
    await supabase.from('tasks').delete().eq('id', task.id)
  }

  async function addTask() {
    if (!newTask.trim() || !user) return
    await supabase.from('tasks').insert({ title: newTask.trim(), user_id: user.id })
    setNewTask('')
  }

  return (
    <div className="page home-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 className="page-title">
            Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}<span className="accent-glyph">.</span>
          </h1>
          <div className="page-sub">
            {tasks.filter(t => !t.done).length} tasks open · {todays.length} events today
          </div>
        </div>
        <div className="header-tools">
          <button className="chip primary" onClick={() => setQuickModal(true)}>
            <PlusIcon width="14" height="14" /> quick add
          </button>
        </div>
      </header>

      <div className="home-grid">
        {/* Hero — next up */}
        <section className="panel glass hero-panel" style={{ gridArea: 'hero' }}>
          <AlgorithmicOrnament variant="arc" seed={7} position="tr" size={140} />
          <div className="hero-eyebrow">
            {next ? `Next up · in ${minsUntil} min` : 'Nothing scheduled'}
          </div>
          <h2 className="hero-title">{next?.title || 'Free time'}</h2>
          <div className="hero-meta">
            {next && `${fmtTime(new Date(next.start))} — ${fmtTime(new Date(next.end || next.start))}`}
          </div>
          <div className="hero-orb" aria-hidden="true" />
        </section>

        {/* Timeline */}
        <section className="panel glass" style={{ gridArea: 'timeline' }}>
          <AlgorithmicOrnament variant="wave" seed={42} position="bl" size={130} />
          <div className="panel-head" {...(isMobile ? { onClick: () => setPage('calendar'), style: { cursor: 'pointer' } } : {})}>
            <h3>Today's schedule</h3>
            <span className="muted">{todays.length} event{todays.length === 1 ? '' : 's'}{isMobile && ' ›'}</span>
          </div>
          {todays.length === 0 ? (
            <ScheduleEmpty onAdd={() => setQuickModal(true)} />
          ) : (
          <ul className="timeline">
            {todays.map(e => {
              const isPast = e._end < now
              const isNext = next && e.id === next.id && !isPast
              const hasEnd = e.end && e._end > e._start
              return (
                <li key={e.id} className={`tl-row ${isPast ? 'past' : ''} ${isNext ? 'next' : ''}`}>
                  <span className="tl-time">
                    {fmtTime(e._start)}
                    {hasEnd && <span className="tl-time-end">{fmtTime(e._end)}</span>}
                  </span>
                  <span className={`tl-bar ${e.tag || 'ev-tag1'}`} />
                  <span className="tl-body">
                    <span className="tl-title">{e.title}</span>
                    <span className="tl-meta">
                      {hasEnd
                        ? `${Math.max(1, Math.round((e._end - e._start) / 60000))} min`
                        : 'all day'}
                    </span>
                  </span>
                  {isNext && <span className="tl-badge">next</span>}
                </li>
              )
            })}
          </ul>
          )}
        </section>

        {/* Tasks */}
        <section className="panel glass" style={{ gridArea: 'tasks' }}>
          <div className="panel-head">
            <h3>Tasks</h3>
            <span className="muted">{tasks.filter(t => !t.done).length} open</span>
          </div>
          <ul className="tasks">
            {tasks.map(t => (
              <li key={t.id} className={`task ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t)}>
                <span className={`check ${t.done ? 'on' : ''}`} />
                <span className="task-text">{t.title}</span>
                <button className="task-del" onClick={e => deleteTask(e, t)} aria-label="delete task">×</button>
              </li>
            ))}
          </ul>
          <div className="task-add">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="add a task…"
            />
            <button className="task-add-btn" onClick={addTask} aria-label="add task">+</button>
          </div>
        </section>

        {/* Mini calendar */}
        <section className="panel glass" style={{ gridArea: 'mini' }} {...(isMobile ? { onClick: () => setPage('calendar'), style: { gridArea: 'mini', cursor: 'pointer' } } : {})}>
          <MiniCalendar events={events} />
        </section>
      </div>

      {quickModal && (
        <EventFormModal
          mode="create"
          defaultValues={{ allDay: false, startTime: `${todayDateStr()}T09:00`, endTime: `${todayDateStr()}T10:00`, tag: 'ev-tag1' }}
          onClose={() => setQuickModal(false)}
        />
      )}
    </div>
  )
}

function PlusIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
}

// rotating empty-state copy — picked deterministically by date so it stays
// consistent through the day instead of jittering between renders.
const EMPTY_LINES = [
  { eyebrow: 'wide open',       title: 'A day to yourself.',         hint: 'Block time before it blocks you.' },
  { eyebrow: 'clean slate',     title: 'Nothing booked.',            hint: 'Make the first move.' },
  { eyebrow: 'today',           title: 'Free as a bird.',            hint: 'Add something — or don’t.' },
  { eyebrow: 'quiet hours',     title: 'Calendar is quiet.',         hint: 'Good day to do one thing well.' },
  { eyebrow: 'unscheduled',     title: 'Your canvas is empty.',      hint: 'Sketch the day.' },
  { eyebrow: 'open agenda',     title: 'No plans yet.',              hint: 'Pick a moment, claim it.' },
  { eyebrow: 'breathing room',  title: 'Today is undecided.',        hint: 'Decide what matters.' },
  { eyebrow: 'just today',      title: 'Infinite possibilities.',    hint: 'Or just one good one.' },
]

function ScheduleEmpty({ onAdd }) {
  const idx = new Date().getDate() % EMPTY_LINES.length
  const line = EMPTY_LINES[idx]
  return (
    <div className="tl-empty">
      <svg className="tl-empty-glyph" viewBox="0 0 120 120" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx="60" cy="60" r={14 + i * 8} />
        ))}
        <circle className="tl-empty-dot" cx="60" cy="60" r="4" />
      </svg>
      <div className="tl-empty-eyebrow">{line.eyebrow}</div>
      <div className="tl-empty-title">{line.title}</div>
      <div className="tl-empty-hint">{line.hint}</div>
      <button className="chip primary" onClick={onAdd}>
        <PlusIcon width="14" height="14" /> add event
      </button>
    </div>
  )
}
