import { authenticateRequest, unauthorized, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'
import { pickBest } from '../../../lib/suggestion-engine'

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const { user } = auth

  try {
    const db = createServiceClient()

    // Fetch pending tasks
    const { data: tasks } = await db
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('done', false)
      .order('created_at')

    // Fetch pending sessions (with job info)
    const { data: sessions } = await db
      .from('sessions')
      .select('*, jobs!inner(title, deadline, priority, status)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .eq('jobs.status', 'active')
      .order('order_index')

    // Get job progress for each session's job
    const jobIds = [...new Set((sessions || []).map(s => s.job_id))]
    const jobProgress = {}
    for (const jobId of jobIds) {
      const { data: allSessions } = await db
        .from('sessions')
        .select('status')
        .eq('job_id', jobId)
      const total = (allSessions || []).length
      const completed = (allSessions || []).filter(s => s.status === 'completed').length
      jobProgress[jobId] = { completed, total }
    }

    // Fetch behavior patterns
    const { data: behaviors } = await db
      .from('behavior_memory')
      .select('pattern_type, pattern_data')
      .eq('user_id', user.id)

    const behaviorData = {}
    for (const b of (behaviors || [])) {
      behaviorData[b.pattern_type] = b.pattern_data
    }

    // Normalize items for scoring
    const scorableItems = [
      ...(tasks || []).map(t => ({
        ...t,
        _type: 'task',
        estimated_minutes: t.estimated_minutes || 30,
      })),
      ...(sessions || []).map(s => ({
        ...s,
        _type: 'session',
        priority: s.jobs?.priority || 2,
        deadline: s.jobs?.deadline,
        job_title: s.jobs?.title,
        _progress: jobProgress[s.job_id] || null,
      })),
    ]

    const suggestion = pickBest(scorableItems, behaviorData)

    if (!suggestion) {
      return Response.json({
        suggestion: null,
        message: "You're all caught up. Nothing to do right now.",
      })
    }

    return Response.json({
      suggestion: suggestion.item,
      score: suggestion.score,
      reason: suggestion.reason,
      message: null,
    })
  } catch (e) {
    console.error('[suggestion]', e)
    return serverError()
  }
}
