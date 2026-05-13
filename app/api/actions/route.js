import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'

export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.item_type || !body.item_id || !body.action) {
    return badRequest('item_type, item_id, and action are required')
  }

  const now = new Date()
  const db = createServiceClient()

  // Log the action
  const { data: actionLog, error: actionErr } = await db
    .from('actions')
    .insert({
      user_id: auth.user.id,
      item_type: body.item_type,
      item_id: body.item_id,
      action: body.action,
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      estimated_minutes: body.estimated_minutes || null,
      actual_minutes: body.actual_minutes || null,
    })
    .select()
    .single()

  if (actionErr) return serverError(actionErr.message)

  // Apply side effects
  if (body.action === 'done') {
    if (body.item_type === 'task') {
      await db.from('tasks').update({ done: true }).eq('id', body.item_id).eq('user_id', auth.user.id)
    } else if (body.item_type === 'session') {
      await db.from('sessions').update({
        status: 'completed',
        completed_at: now.toISOString(),
        actual_time: body.actual_minutes || null,
      }).eq('id', body.item_id).eq('user_id', auth.user.id)

      // Check job completion
      const { data: session } = await db.from('sessions').select('job_id').eq('id', body.item_id).single()
      if (session?.job_id) {
        const { data: remaining } = await db
          .from('sessions')
          .select('id')
          .eq('job_id', session.job_id)
          .in('status', ['pending', 'in_progress'])
        if (!remaining?.length) {
          await db.from('jobs').update({ status: 'completed', updated_at: now.toISOString() }).eq('id', session.job_id)
        }
      }
    }
  } else if (body.action === 'skip') {
    if (body.item_type === 'session') {
      await db.from('sessions').update({ status: 'skipped' }).eq('id', body.item_id).eq('user_id', auth.user.id)
    }
  }

  return Response.json({ action: actionLog }, { status: 201 })
}

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  const db = createServiceClient()
  const { data, error } = await db
    .from('actions')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return serverError(error.message)
  return Response.json({ actions: data })
}
