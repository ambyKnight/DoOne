import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../../lib/auth'
import { createServiceClient } from '../../../../lib/supabase-server'
import { getAnthropicClient } from '../../../../lib/anthropic'

// Planner Agent — breaks a job into sessions
export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.job_id) return badRequest('job_id is required')

  const db = createServiceClient()
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .select('*')
    .eq('id', body.job_id)
    .eq('user_id', auth.user.id)
    .single()

  if (jobErr || !job) return badRequest('Job not found')

  try {
    const ai = getAnthropicClient()
    const response = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a task planner. Break work into focused sessions.
Return ONLY valid JSON — an array of objects with "title" (string) and "duration" (integer, minutes).
Total duration must equal the given total_time. Each session should be 15-90 minutes.
No explanations, no markdown, no code fences. Just the JSON array.`,
      messages: [{
        role: 'user',
        content: `Break this job into sessions:
Title: ${job.title}
${job.description ? `Description: ${job.description}` : ''}
Total time: ${job.total_time} minutes
${job.deadline ? `Deadline: ${job.deadline}` : ''}`,
      }],
    })

    const text = response.content[0].text.trim()
    let sessions
    try {
      sessions = JSON.parse(text)
    } catch {
      return serverError('AI returned invalid JSON')
    }

    if (!Array.isArray(sessions)) return serverError('AI returned non-array')

    // Validate total duration
    const totalDuration = sessions.reduce((s, sess) => s + (sess.duration || 0), 0)
    if (Math.abs(totalDuration - job.total_time) > 5) {
      // Scale to match
      const scale = job.total_time / totalDuration
      sessions = sessions.map(s => ({
        ...s,
        duration: Math.max(15, Math.round((s.duration || 30) * scale)),
      }))
    }

    // Insert sessions
    const rows = sessions.map((s, i) => ({
      user_id: auth.user.id,
      job_id: job.id,
      title: s.title,
      duration: Math.max(15, Math.min(90, s.duration || 30)),
      order_index: i,
      status: 'pending',
    }))

    const { data: created, error: insertErr } = await db
      .from('sessions')
      .insert(rows)
      .select()

    if (insertErr) return serverError(insertErr.message)

    return Response.json({ sessions: created }, { status: 201 })
  } catch (e) {
    console.error('[ai/breakdown]', e)
    // Fallback: split evenly into 30-min sessions
    const count = Math.max(1, Math.ceil(job.total_time / 30))
    const dur = Math.round(job.total_time / count)
    const fallback = Array.from({ length: count }, (_, i) => ({
      user_id: auth.user.id,
      job_id: job.id,
      title: `Part ${i + 1}`,
      duration: dur,
      order_index: i,
      status: 'pending',
    }))

    const { data: created } = await db.from('sessions').insert(fallback).select()
    return Response.json({ sessions: created, fallback: true }, { status: 201 })
  }
}
