import { authenticateAdmin } from '../../../../lib/adminAuth'
import { createServiceClient } from '../../../../lib/supabase-server'
import { TABLES } from '../tables/route'

// GET ?table=NAME&limit=50&offset=0&q=text
// Returns { rows, count, table }
export async function GET(request) {
  const auth = await authenticateAdmin(request)
  if (auth.response) return auth.response

  const url = new URL(request.url)
  const tableName = url.searchParams.get('table')
  const limit  = Math.min(500, +(url.searchParams.get('limit') || 50))
  const offset = Math.max(0, +(url.searchParams.get('offset') || 0))
  const q      = (url.searchParams.get('q') || '').trim()

  const table = TABLES.find(t => t.name === tableName)
  if (!table) return Response.json({ error: 'unknown table' }, { status: 400 })

  const db = createServiceClient()
  let query = db.from(table.name).select('*', { count: 'exact' })
  if (table.userScoped) query = query.eq('user_id', auth.user.id)

  // Free-text — best-effort: scan likely text columns.
  if (q) {
    const textCols = guessTextCols(table.name)
    if (textCols.length) {
      const ors = textCols.map(c => `${c}.ilike.%${q}%`).join(',')
      query = query.or(ors)
    }
  }

  query = query.order(table.orderBy, { ascending: !table.desc, nullsFirst: false })
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rows: data || [], count: count ?? 0, table: table.name, limit, offset })
}

function guessTextCols(name) {
  switch (name) {
    case 'events': return ['title']
    case 'tasks': return ['title']
    case 'jobs': return ['title', 'description']
    case 'sessions': return ['title']
    case 'journal_entries': return ['did', 'plan', 'mood']
    case 'ai_runs': return ['prompt', 'response_text']
    case 'insights': return ['summary_text']
    case 'behavior_memory': return ['summary_text', 'pattern_type']
    case 'actions': return ['action', 'target_type']
    case 'profiles': return ['username']
    default: return []
  }
}
