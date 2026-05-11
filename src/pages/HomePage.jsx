import { useState } from 'react'
import MiniCalendar from '../components/MiniCalendar'
import EventFormModal from '../components/EventFormModal'
import { supabase } from '../lib/supabaseClient'

const fmtTime = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function todayDateStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function HomePage({ events, tasks, setTasks }) {
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
    if (!newTask.trim()) return
    await supabase.from('tasks').insert({ title: newTask.trim() })
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
          <div className="panel-head">
            <h3>Today's schedule</h3>
            <span className="muted">{todays.length} events</span>
          </div>
          <ul className="timeline">
            {todays.length === 0 && (
              <li className="tl-row free">
                <span className="tl-time">—</span>
                <span className="tl-bar ghost" />
                <span className="tl-body"><span className="tl-title muted">Nothing scheduled today</span></span>
              </li>
            )}
            {todays.map(e => (
              <li key={e.id} className={`tl-row ${e._end < now ? 'past' : ''}`}>
                <span className="tl-time">{fmtTime(e._start)}</span>
                <span className={`tl-bar ${e.tag || 'ev-tag1'}`} />
                <span className="tl-body">
                  <span className="tl-title">{e.title}</span>
                </span>
              </li>
            ))}
          </ul>
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
        <section className="panel glass" style={{ gridArea: 'mini' }}>
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
