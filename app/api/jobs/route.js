import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('jobs')
    .select('*, sessions(id, title, duration, order_index, status)')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error.message)
  return Response.json({ jobs: data })
}

export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.title?.trim()) return badRequest('title is required')
  if (!body.total_time || body.total_time < 1) return badRequest('total_time must be >= 1')

  const db = createServiceClient()
  const { data, error } = await db
    .from('jobs')
    .insert({
      user_id: auth.user.id,
      title: body.title.trim(),
      description: body.description || null,
      total_time: body.total_time,
      deadline: body.deadline || null,
      priority: body.priority || 2,
    })
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ job: data }, { status: 201 })
}

export async function PATCH(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.id) return badRequest('id is required')

  const updates = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.status !== undefined) updates.status = body.status
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.deadline !== undefined) updates.deadline = body.deadline
  updates.updated_at = new Date().toISOString()

  const db = createServiceClient()
  const { data, error } = await db
    .from('jobs')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ job: data })
}
