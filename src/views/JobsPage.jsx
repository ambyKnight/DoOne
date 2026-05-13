import { useState, useEffect } from 'react'
import { useJobsStore } from '../../stores/jobs'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'

export default function JobsPage() {
  const { user } = useAuth()
  const { jobs, loading, fetchJobs, createJob } = useJobsStore()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [totalTime, setTotalTime] = useState(120)
  const [priority, setPriority] = useState(2)
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (token) fetchJobs(token)
    })
  }, [user])

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim() || !user) return
    setCreating(true)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      await createJob(token, {
        title: title.trim(),
        description: description.trim() || null,
        total_time: totalTime,
        priority,
        deadline: deadline || null,
      })
    }
    setCreating(false)
    setShowForm(false)
    setTitle('')
    setDescription('')
    setTotalTime(120)
    setPriority(2)
    setDeadline('')
  }

  const active = jobs.filter(j => j.status === 'active')
  const completed = jobs.filter(j => j.status === 'completed')

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">jobs</div>
          <h1 className="page-title">Jobs</h1>
          <div className="page-sub">
            {active.length} active · {completed.length} completed
          </div>
        </div>
        <div className="header-tools">
          <button className="chip primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'cancel' : '+ new job'}
          </button>
        </div>
      </header>

      {showForm && (
        <section className="panel glass" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate}>
            <div className="panel-head"><h3>New Job</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <label>
                Title
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. OOP Assignment" autoFocus />
              </label>
              <label>
                Description (optional)
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this involve?" rows={2} />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ flex: 1 }}>
                  Total time (minutes)
                  <input type="number" min="15" step="15" value={totalTime} onChange={e => setTotalTime(+e.target.value)} />
                </label>
                <label style={{ flex: 1 }}>
                  Priority (1-5)
                  <input type="number" min="1" max="5" value={priority} onChange={e => setPriority(+e.target.value)} />
                </label>
              </div>
              <label>
                Deadline (optional)
                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </label>
              <button className="chip primary" type="submit" disabled={creating || !title.trim()}>
                {creating ? 'Creating & breaking down…' : 'Create job'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.length === 0 && !showForm && !loading && (
          <div className="panel glass">
            <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
              No active jobs. Create one to get started.
            </div>
          </div>
        )}
        {active.map(job => <JobCard key={job.id} job={job} />)}
        {completed.length > 0 && (
          <>
            <div className="muted small" style={{ marginTop: 8 }}>Completed</div>
            {completed.map(job => <JobCard key={job.id} job={job} />)}
          </>
        )}
      </div>
    </div>
  )
}

function JobCard({ job }) {
  const sessions = job.sessions || []
  const done = sessions.filter(s => s.status === 'completed').length
  const total = sessions.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <section className="panel glass">
      <div className="panel-head">
        <h3>{job.title}</h3>
        <span className="muted">{job.status}</span>
      </div>
      {job.description && <div className="muted small" style={{ marginTop: 4 }}>{job.description}</div>}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span>{done}/{total} sessions</span>
          <span>{pct}%</span>
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 6, transition: 'width 0.3s' }} />
        </div>
      </div>
      {sessions.length > 0 && (
        <ul style={{ listStyle: 'none', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sessions.sort((a, b) => a.order_index - b.order_index).map(s => (
            <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: s.status === 'completed' ? 0.5 : 1 }}>
              <span>{s.status === 'completed' ? '✓ ' : '○ '}{s.title}</span>
              <span className="muted">{s.duration}m</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
