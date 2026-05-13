// Static list of inspectable tables + their primary key column.
// Hard-coded to prevent SQL injection via dynamic table names.
export const TABLES = [
  { name: 'events',            pk: 'id', userScoped: true,  orderBy: 'start_time', desc: true },
  { name: 'tasks',             pk: 'id', userScoped: true,  orderBy: 'created_at', desc: true },
  { name: 'jobs',              pk: 'id', userScoped: true,  orderBy: 'created_at', desc: true },
  { name: 'sessions',          pk: 'id', userScoped: true,  orderBy: 'created_at', desc: true },
  { name: 'journal_entries',   pk: 'id', userScoped: true,  orderBy: 'entry_date', desc: true },
  { name: 'user_preferences',  pk: 'id', userScoped: true,  orderBy: 'updated_at', desc: true },
  { name: 'profiles',          pk: 'id', userScoped: false, orderBy: 'created_at', desc: true },
  { name: 'ai_runs',           pk: 'id', userScoped: true,  orderBy: 'created_at', desc: true },
  { name: 'insights',          pk: 'id', userScoped: true,  orderBy: 'period_end',  desc: true },
  { name: 'behavior_memory',   pk: 'id', userScoped: true,  orderBy: 'updated_at', desc: true },
  { name: 'actions',           pk: 'id', userScoped: true,  orderBy: 'created_at', desc: true },
]

import { authenticateAdmin } from '../../../../lib/adminAuth'

export async function GET(request) {
  const auth = await authenticateAdmin(request)
  if (auth.response) return auth.response
  return Response.json({ tables: TABLES })
}
