// Uploads preview.json._full to Supabase via service_role.
// - journals: UPSERT on (user_id, entry_date) — safe to re-run
// - jobs:     INSERT (no dedup constraint — re-running creates duplicates)
// - events:   INSERT (same caveat)
//
// Reads env from .env / .env.local manually (no next.js loader here).

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(p) {
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
const ROOT = 'C:/Users/mvn_/Desktop/Projects/day_planner/.claude/worktrees/loving-chebyshev-08fec8'
loadEnv(`${ROOT}/.env.local`)
loadEnv(`${ROOT}/.env`)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const preview = JSON.parse(fs.readFileSync(`${ROOT}/scripts/preview.json`, 'utf8'))
const { journals, jobs, events } = preview._full

console.log(`Uploading for user ${preview.user_id}`)
console.log(`  journals: ${journals.length}`)
console.log(`  jobs:     ${jobs.length}`)
console.log(`  events:   ${events.length}`)
console.log('')

// ── Journals (upsert) ──
{
  const { data, error } = await sb
    .from('journal_entries')
    .upsert(journals, { onConflict: 'user_id,entry_date' })
    .select('entry_date')
  if (error) { console.error('[journals]', error); process.exit(1) }
  console.log(`✓ journals: ${data.length} upserted`)
}

// ── Jobs (insert) ──
{
  const { data, error } = await sb.from('jobs').insert(jobs).select('id,title')
  if (error) { console.error('[jobs]', error); process.exit(1) }
  console.log(`✓ jobs: ${data.length} inserted`)
}

// ── Events (insert) ──
{
  const { data, error } = await sb.from('events').insert(events).select('id')
  if (error) { console.error('[events]', error); process.exit(1) }
  console.log(`✓ events: ${data.length} inserted`)
}

console.log('')
console.log('Done.')
