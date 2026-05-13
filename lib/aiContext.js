// Server-side context bundler. Gathers everything AI should see in one place.
// Returns { bundle, text }:
//   bundle — structured JSON (for debug panel)
//   text   — preformatted block (what AI actually sees)

const ymd = d => new Date(d).toISOString().slice(0, 10)
const fmtTime = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export async function buildContext(db, userId) {
  const today = ymd(new Date())
  const startOfToday = new Date(today + 'T00:00:00').toISOString()
  const endOfToday = new Date(today + 'T23:59:59').toISOString()

  // Parallel fetch — single round trip per table.
  const [
    eventsRes,
    openTasksRes,
    doneTasksRes,
    jobsRes,
    sessionsRes,
    journalRes,
    insightsRes,
    behaviorRes,
  ] = await Promise.all([
    db.from('events').select('*')
      .eq('user_id', userId)
      .gte('start_time', startOfToday)
      .lte('start_time', endOfToday)
      .order('start_time'),
    db.from('tasks').select('*')
      .eq('user_id', userId)
      .eq('done', false)
      .order('created_at', { ascending: false }),
    db.from('tasks').select('*')
      .eq('user_id', userId)
      .eq('done', true)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('jobs').select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    db.from('sessions').select('*')
      .eq('user_id', userId),
    db.from('journal_entries').select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .limit(2),
    db.from('insights').select('*')
      .eq('user_id', userId)
      .order('period_end', { ascending: false }),
    db.from('behavior_memory').select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ])

  const events = eventsRes.data || []
  const openTasks = openTasksRes.data || []
  const doneTasks = doneTasksRes.data || []
  const jobs = jobsRes.data || []
  const sessions = sessionsRes.data || []
  const journals = journalRes.data || []
  const insights = insightsRes.data || []
  const behaviors = behaviorRes.data || []

  // Attach sessions to their jobs.
  const jobsWithSessions = jobs.map(j => ({
    ...j,
    sessions: sessions.filter(s => s.job_id === j.id).sort((a, b) => a.order_index - b.order_index),
  }))

  const bundle = {
    today,
    events,
    openTasks,
    doneTasks,
    jobs: jobsWithSessions,
    journals,
    insights,
    behaviors,
  }

  const text = formatContext(bundle)
  return { bundle, text }
}

function formatContext(b) {
  const lines = []
  lines.push(`# Context for ${b.today}`)
  lines.push('')

  // Today's events
  lines.push('## Today\'s events')
  if (b.events.length === 0) lines.push('(none)')
  else for (const e of b.events) {
    const time = e.all_day ? 'all-day' : `${fmtTime(e.start_time)}${e.end_time ? `–${fmtTime(e.end_time)}` : ''}`
    lines.push(`- [${time}] ${e.title}${e.tag ? ` (${e.tag})` : ''}`)
  }
  lines.push('')

  // Open tasks
  lines.push(`## Open tasks (${b.openTasks.length})`)
  if (b.openTasks.length === 0) lines.push('(none)')
  else for (const t of b.openTasks) lines.push(`- ${t.title}`)
  lines.push('')

  // Recently completed tasks
  if (b.doneTasks.length > 0) {
    lines.push(`## Recently completed (last ${b.doneTasks.length})`)
    for (const t of b.doneTasks) lines.push(`- ✓ ${t.title}`)
    lines.push('')
  }

  // Active jobs
  lines.push(`## Active jobs (${b.jobs.length})`)
  if (b.jobs.length === 0) lines.push('(none)')
  else for (const j of b.jobs) {
    const done = j.sessions.filter(s => s.status === 'completed').length
    const total = j.sessions.length
    lines.push(`### ${j.title}  [${done}/${total} sessions · priority ${j.priority}${j.deadline ? ` · due ${j.deadline}` : ''}]`)
    if (j.description) lines.push(`  ${j.description}`)
    for (const s of j.sessions) {
      const mark = s.status === 'completed' ? '✓' : '○'
      lines.push(`  ${mark} ${s.title} (${s.duration}m)`)
    }
  }
  lines.push('')

  // Journal entries
  lines.push(`## Recent journal entries (${b.journals.length})`)
  if (b.journals.length === 0) lines.push('(none)')
  else for (const j of b.journals) {
    lines.push(`### ${j.entry_date}`)
    if (j.did)  lines.push(`  did:  ${j.did}`)
    if (j.plan) lines.push(`  plan: ${j.plan}`)
    if (j.mood) lines.push(`  mood: ${j.mood}`)
  }
  lines.push('')

  // Weekly insights (AI's previous conclusions)
  lines.push(`## Past weekly insights (${b.insights.length})`)
  if (b.insights.length === 0) lines.push('(none yet)')
  else for (const i of b.insights) {
    lines.push(`### ${i.period_start} → ${i.period_end}`)
    if (i.summary_text) lines.push(`  ${i.summary_text}`)
    if (i.stats) lines.push(`  stats: ${JSON.stringify(i.stats)}`)
  }
  lines.push('')

  // Behavior patterns
  lines.push(`## Known behavior patterns (${b.behaviors.length})`)
  if (b.behaviors.length === 0) lines.push('(none yet)')
  else for (const p of b.behaviors) {
    lines.push(`- [${p.pattern_type}] ${p.summary_text || JSON.stringify(p.pattern_data)}`)
  }

  return lines.join('\n')
}
