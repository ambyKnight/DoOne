import { authenticateRequest, unauthorized, serverError } from '../../../../lib/auth'
import { createServiceClient } from '../../../../lib/supabase-server'
import { getAnthropicClient } from '../../../../lib/anthropic'

// Insight Agent — generates weekly summaries
export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Fetch recent actions
  const { data: actions } = await db
    .from('actions')
    .select('*')
    .eq('user_id', auth.user.id)
    .gte('created_at', weekAgo.toISOString())

  if (!actions?.length) {
    return Response.json({ message: 'Not enough activity data for insights' })
  }

  // Compute stats
  const tasksCompleted = actions.filter(a => a.item_type === 'task' && a.action === 'done').length
  const sessionsCompleted = actions.filter(a => a.item_type === 'session' && a.action === 'done').length
  const totalSkips = actions.filter(a => a.action === 'skip').length
  const totalActions = actions.length

  // Best day
  const dayCounts = Array(7).fill(0)
  for (const a of actions) {
    if (a.action === 'done' && a.day_of_week != null) dayCounts[a.day_of_week]++
  }
  const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts))
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const bestDay = dayNames[bestDayIdx]

  const stats = { tasksCompleted, sessionsCompleted, totalSkips, totalActions, bestDay }

  const periodStart = weekAgo.toISOString().slice(0, 10)
  const periodEnd = now.toISOString().slice(0, 10)

  try {
    const ai = getAnthropicClient()
    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You write weekly productivity summaries. 2-3 sentences. Specific numbers.
Warm, encouraging but honest. No emojis. Return ONLY the summary text.`,
      messages: [{
        role: 'user',
        content: `Weekly stats (${periodStart} to ${periodEnd}):
Tasks completed: ${tasksCompleted}
Sessions completed: ${sessionsCompleted}
Total skips: ${totalSkips}
Best day: ${bestDay}
Total actions: ${totalActions}`,
      }],
    })

    const summaryText = response.content[0].text.trim()

    const { data: insight } = await db.from('insights').insert({
      user_id: auth.user.id,
      period_start: periodStart,
      period_end: periodEnd,
      summary_text: summaryText,
      stats,
    }).select().single()

    return Response.json({ insight })
  } catch (e) {
    console.error('[ai/insights]', e)
    const fallbackText = `This week you completed ${tasksCompleted} tasks and ${sessionsCompleted} sessions. Your best day was ${bestDay}.`
    const { data: insight } = await db.from('insights').insert({
      user_id: auth.user.id,
      period_start: periodStart,
      period_end: periodEnd,
      summary_text: fallbackText,
      stats,
    }).select().single()

    return Response.json({ insight, fallback: true })
  }
}
