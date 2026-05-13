// Parses 21 markdown day-logs into journal_entries / jobs / events.
// DRY RUN — writes preview JSON. No DB writes.
//
// Dates are RE-MAPPED: day_01.md → 21 days before today, day_21.md → 1 day before today.
// "Today" is taken from system clock (project's currentDate context says 2026-05-13).

import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = 'C:/Users/mvn_/Desktop/ai_synthesized_data/logs'
const OUT_FILE = 'C:/Users/mvn_/Desktop/Projects/day_planner/.claude/worktrees/loving-chebyshev-08fec8/scripts/preview.json'
const USER_ID = '2bae86b3-d685-44f6-be85-7587f9a32ebd'

// Anchor "today" so the project's logical today (2026-05-13) is the day AFTER
// day_21. day_01 lands 21 days before today.
const TODAY = new Date('2026-05-13T00:00:00')

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function dayMinus(d, n) {
  const c = new Date(d); c.setDate(c.getDate() - n); return c
}
// day_N (1..21) → date = TODAY - (22 - N) days.
// day_21 → TODAY - 1 (yesterday). day_01 → TODAY - 21.
function dateForDay(n) { return ymd(dayMinus(TODAY, 22 - n)) }

function splitSections(md) {
  const sections = {}
  const lines = md.split(/\r?\n/)
  let current = null
  let buf = []
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/)
    if (h) {
      if (current) sections[current] = buf.join('\n').trim()
      current = h[1].replace(/\s*\(.*\)$/, '').trim()
      buf = []
    } else {
      buf.push(line)
    }
  }
  if (current) sections[current] = buf.join('\n').trim()
  return sections
}

function extractMood(s) {
  if (!s) return ''
  return s.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim()
}

function bulletItems(s) {
  if (!s) return []
  return s.split('\n')
    .map(l => l.trim())
    .filter(l => /^[-*]\s+/.test(l))
    .map(l => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
}

function parseAssignmentTable(s) {
  if (!s) return []
  const rows = []
  for (const line of s.split('\n')) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length !== 2) continue
    if (cells[0].toLowerCase() === 'item' || /^-+$/.test(cells[0])) continue
    const item = cells[0].replace(/\*\*/g, '').replace(/`/g, '').trim()
    const status = cells[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
    rows.push({ item, status })
  }
  return rows
}

function canonical(item) {
  const i = item.toLowerCase()
  if (i.includes('signals')) return 'Signals problem set'
  if (i.includes('ent') && i.includes('paper')) return 'Entrepreneurship paper'
  if (i.includes('ent') && i.includes('group')) return 'Entrepreneurship group project'
  if (i.includes('lab record')) return 'Microprocessors lab record'
  if (i.includes('back-assignment 1') || i.includes('back assignment 1')) return 'Back-assignment 1'
  if (i.includes('back-assignment 2') || i.includes('back assignment 2')) return 'Back-assignment 2'
  if (i.includes('back-assignment 3') || i.includes('back assignment 3')) return 'Back-assignment 3'
  if (i.includes('back-assignment') || i.includes('back assignment')) return 'Back-assignments (general)'
  if (i.includes('microproc practice') || i.includes('practice problems')) return 'Microprocessors practice problems'
  if (i.includes('end-sem')) return 'End-semester revision'
  return item
}

// Map a bullet intention → { startHour, durationMin, tag }
// Heuristic — looks at keywords. Anything unmatched gets a default slot from
// a per-day round-robin so events spread instead of stacking.
const SLOT_DEFAULTS = [
  { h: 9,  d: 60 },
  { h: 11, d: 60 },
  { h: 14, d: 90 },
  { h: 16, d: 60 },
  { h: 18, d: 60 },
  { h: 20, d: 60 },
]
function intentionToEvent(text) {
  const t = text.toLowerCase()
  if (t.startsWith('wake') || t.startsWith('sleep')) return null
  if (t.startsWith('(') || t.startsWith('end-sems start')) return null

  // Only emit events for intentions with an explicit anchor (time or strong
  // keyword). Vague to-do items ("study", "review") aren't real schedule
  // blocks — they'd just clutter the calendar.
  const time = t.match(/(?<![:\d])(\d{1,2})\s*(am|pm)/)
  if (time) {
    let h = +time[1]
    if (h > 23) h = 12
    if (time[2] === 'pm' && h !== 12) h += 12
    if (time[2] === 'am' && h === 12) h = 0
    return { hour: h, duration: 60, title: text }
  }
  if (t.includes('class') || t.includes('attend')) return { hour: 9, duration: 360, title: text }
  if (t.includes('gym')) return { hour: 18, duration: 60, title: text }
  if (t.includes('club')) return { hour: 17, duration: 120, title: text }
  if (t.includes('mom') && t.includes('call')) return { hour: 21, duration: 15, title: text }
  return null  // no fallback — drop unmatched intentions
}

function isoAt(dateStr, hour, min = 0) {
  return `${dateStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`
}
function addMin(isoStr, mins) {
  const d = new Date(isoStr)
  d.setMinutes(d.getMinutes() + mins)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`
}

const TAG_BY_KEYWORD = [
  [/class|attend/, 'ev-tag2'],
  [/club/, 'ev-tag3'],
  [/gym|run|walk/, 'ev-tag4'],
  [/signal|microproc|lab|assignment|paper|ent|practice/, 'ev-tag1'],
  [/mom|call/, 'ev-tag5'],
]
function tagFor(text) {
  const t = text.toLowerCase()
  for (const [re, tag] of TAG_BY_KEYWORD) if (re.test(t)) return tag
  return 'ev-tag1'
}

// ── Process ──────────────────────────────────────────────────────
const files = fs.readdirSync(LOG_DIR).filter(f => /^day_\d+\.md$/.test(f)).sort()
const journals = []
const events = []
const assignmentTimeline = {}

for (const fname of files) {
  const dayNum = +fname.match(/day_(\d+)/)[1]
  const date = dateForDay(dayNum)
  const txt = fs.readFileSync(path.join(LOG_DIR, fname), 'utf8')
  const sec = splitSections(txt)

  const intended = sec['Intended'] || ''
  const actual   = sec['Actual'] || ''
  const metrics  = sec['Metrics'] || ''
  const status   = sec['Assignment Status'] || ''
  const mood     = sec['Mood'] || ''
  const notes    = sec['Notes to Self'] || ''

  // Journal: three clean fields
  const did = [
    actual && `### What happened\n\n${actual}`,
    metrics && `### Metrics\n\n${metrics}`,
  ].filter(Boolean).join('\n\n')
  const plan = [
    intended && `### Intended (set night before)\n\n${intended}`,
    notes && `### Notes to self (for tomorrow)\n\n${notes}`,
  ].filter(Boolean).join('\n\n')
  journals.push({ user_id: USER_ID, entry_date: date, did, plan, mood: extractMood(mood) })

  // Events from Intended bullets — dated to this day
  const intentions = bulletItems(intended)
  for (const intent of intentions) {
    const ev = intentionToEvent(intent)
    if (!ev) continue
    const start = isoAt(date, ev.hour)
    const end = addMin(start, ev.duration)
    events.push({
      user_id: USER_ID,
      title: ev.title.slice(0, 120),
      start_time: start,
      end_time: end,
      all_day: false,
      tag: tagFor(ev.title),
    })
  }

  // Assignment timeline for jobs
  for (const row of parseAssignmentTable(status)) {
    if (row.item.toLowerCase() === 'all deadlines') continue
    const key = canonical(row.item)
    if (!assignmentTimeline[key]) assignmentTimeline[key] = []
    assignmentTimeline[key].push({ date, raw: row.item, status: row.status })
  }
}

// ── Derive jobs ──
const jobs = []
for (const [key, history] of Object.entries(assignmentTimeline)) {
  if (key === 'Back-assignments (general)') {
    const hasSpecific = ['Back-assignment 1','Back-assignment 2','Back-assignment 3']
      .some(k => assignmentTimeline[k])
    if (hasSpecific) continue
  }
  const last = history[history.length - 1]
  const s = last.status.toLowerCase()
  let jobStatus = 'active'
  if (s.includes('submitted') && !s.includes('not')) jobStatus = 'completed'
  let priority = 3
  if (key.toLowerCase().includes('back-assignment')) priority = 4
  if (key.toLowerCase().includes('end-sem')) priority = 5
  if (key.toLowerCase().includes('practice')) priority = 2
  let total_time = 180
  if (key.includes('Signals')) total_time = 300
  else if (key.includes('lab record')) total_time = 240
  else if (key.includes('paper')) total_time = 240
  else if (key.includes('Back-assignment')) total_time = 180
  else if (key.includes('group project')) total_time = 300
  else if (key.includes('End-semester')) total_time = 900
  else if (key.includes('practice')) total_time = 240
  const description = `Last status (${last.date}): ${last.status}. Tracked across ${history.length} day${history.length===1?'':'s'} of logs.`

  // Deadlines (only for active jobs; completed = null)
  let deadline = null
  if (jobStatus === 'active') {
    const k = key.toLowerCase()
    let daysOut = 14
    if (k.includes('back-assignment 3')) daysOut = 7
    else if (k.includes('group project')) daysOut = 14
    else if (k.includes('practice')) daysOut = 21
    else if (k.includes('end-sem')) daysOut = 35
    const d = new Date(TODAY); d.setDate(d.getDate() + daysOut)
    deadline = `${ymd(d)}T23:59:00`
  }

  jobs.push({
    user_id: USER_ID, title: key, description, total_time, priority,
    status: jobStatus, deadline,
    _history: history,
  })
}

// ── Write preview ──
const preview = {
  generated_at: new Date().toISOString(),
  user_id: USER_ID,
  date_remap: { day_01: dateForDay(1), day_21: dateForDay(21) },
  summary: {
    journal_entries: journals.length,
    jobs: jobs.length,
    events: events.length,
  },
  journals: journals.map(j => ({
    entry_date: j.entry_date,
    did_chars: j.did.length,
    plan_chars: j.plan.length,
    mood_chars: j.mood.length,
    mood_preview: j.mood.slice(0, 120) + (j.mood.length > 120 ? '…' : ''),
  })),
  jobs: jobs.map(j => ({
    title: j.title, status: j.status, priority: j.priority,
    total_time: j.total_time, description: j.description,
    history_days: j._history.length, last_status: j._history.at(-1).status,
  })),
  events_per_day: Object.fromEntries(
    Object.entries(events.reduce((acc, e) => {
      const d = e.start_time.slice(0,10)
      acc[d] = (acc[d] || []).concat([`${e.start_time.slice(11,16)} ${e.title}`])
      return acc
    }, {})).sort(),
  ),
  _full: { journals, jobs: jobs.map(({ _history, ...j }) => j), events },
}

fs.writeFileSync(OUT_FILE, JSON.stringify(preview, null, 2), 'utf8')
console.log(`Wrote preview → ${OUT_FILE}`)
console.log(`Date remap: day_01 → ${dateForDay(1)} (21 days ago), day_21 → ${dateForDay(21)} (yesterday)`)
console.log(`Journals: ${journals.length}`)
console.log(`Jobs: ${jobs.length}`)
console.log(`Events: ${events.length}`)
console.log('')
console.log('=== JOBS ===')
for (const j of jobs) console.log(`  [${j.status.padEnd(9)}] p${j.priority} ${j.total_time}m — ${j.title}`)
console.log('')
console.log('=== EVENTS per day (sample) ===')
const sampleDays = [journals[0].entry_date, journals[10].entry_date, journals[20].entry_date]
for (const d of sampleDays) {
  const dayEvents = events.filter(e => e.start_time.startsWith(d))
  console.log(`  ${d}: ${dayEvents.length} events`)
  for (const e of dayEvents) console.log(`     ${e.start_time.slice(11,16)}–${e.end_time.slice(11,16)}  ${e.title}`)
}
console.log('')
console.log('=== JOURNALS ===')
for (const j of journals) console.log(`  ${j.entry_date}  did:${j.did.length}c plan:${j.plan.length}c mood:${j.mood.length}c`)
