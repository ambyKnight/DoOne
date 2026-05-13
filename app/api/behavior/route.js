import { authenticateRequest, unauthorized, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('behavior_memory')
    .select('*')
    .eq('user_id', auth.user.id)

  if (error) return serverError(error.message)
  return Response.json({ patterns: data })
}

// POST /api/behavior — recompute behavior patterns from action logs
export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()

  // Fetch all actions for this user
  const { data: actions } = await db
    .from('actions')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!actions?.length) {
    return Response.json({ patterns: [], message: 'No action data yet' })
  }

  const now = new Date().toISOString()

  // Compute hourly completion rate
  const hourBuckets = Array(24).fill(null).map(() => ({ done: 0, total: 0 }))
  for (const a of actions) {
    if (a.hour_of_day != null) {
      hourBuckets[a.hour_of_day].total++
      if (a.action === 'done') hourBuckets[a.hour_of_day].done++
    }
  }
  const hourlyCompletion = hourBuckets.map(b => b.total > 0 ? b.done / b.total : 0.5)

  // Compute daily completion rate
  const dayBuckets = Array(7).fill(null).map(() => ({ done: 0, total: 0 }))
  for (const a of actions) {
    if (a.day_of_week != null) {
      dayBuckets[a.day_of_week].total++
      if (a.action === 'done') dayBuckets[a.day_of_week].done++
    }
  }
  const dailyCompletion = dayBuckets.map(b => b.total > 0 ? b.done / b.total : 0.5)

  // Skip patterns
  const skipCount = actions.filter(a => a.action === 'skip').length
  const totalCount = actions.length
  const skipRate = totalCount > 0 ? skipCount / totalCount : 0

  // Preferred duration (average of completed items)
  const completedWithTime = actions.filter(a => a.action === 'done' && a.actual_minutes)
  const avgDuration = completedWithTime.length > 0
    ? Math.round(completedWithTime.reduce((s, a) => s + a.actual_minutes, 0) / completedWithTime.length)
    : 30

  // Upsert all patterns
  const patterns = [
    { type: 'hourly_completion', data: hourlyCompletion },
    { type: 'daily_completion', data: dailyCompletion },
    { type: 'skip_pattern', data: { skip_rate: skipRate, total_skips: skipCount } },
    { type: 'preferred_duration', data: { avg_minutes: avgDuration } },
  ]

  for (const p of patterns) {
    await db.from('behavior_memory').upsert({
      user_id: auth.user.id,
      pattern_type: p.type,
      pattern_data: p.data,
      computed_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,pattern_type' })
  }

  return Response.json({ patterns, message: 'Behavior patterns updated' })
}
