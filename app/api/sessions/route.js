import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')

  const db = createServiceClient()
  let query = db
    .from('sessions')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('order_index')

  if (jobId) query = query.eq('job_id', jobId)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ sessions: data })
}

export async function PATCH(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.id) return badRequest('id is required')

  const updates = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.actual_time !== undefined) updates.actual_time = body.actual_time
  if (body.status === 'in_progress') updates.started_at = new Date().toISOString()
  if (body.status === 'completed') updates.completed_at = new Date().toISOString()

  const db = createServiceClient()
  const { data, error } = await db
    .from('sessions')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) return serverError(error.message)

  // Check if all sessions for this job are done → mark job completed
  if (body.status === 'completed' && data.job_id) {
    const { data: remaining } = await db
      .from('sessions')
      .select('id')
      .eq('job_id', data.job_id)
      .in('status', ['pending', 'in_progress'])

    if (!remaining?.length) {
      await db
        .from('jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', data.job_id)
    }
  }

  return Response.json({ session: data })
}
