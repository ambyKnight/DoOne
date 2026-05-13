import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at')

  if (error) return serverError(error.message)
  return Response.json({ tasks: data })
}

export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.title?.trim()) return badRequest('title is required')

  const db = createServiceClient()
  const { data, error } = await db
    .from('tasks')
    .insert({
      user_id: auth.user.id,
      title: body.title.trim(),
      priority: body.priority || 2,
      estimated_minutes: body.estimated_minutes || 30,
      deadline: body.deadline || null,
    })
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ task: data }, { status: 201 })
}

export async function PATCH(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.id) return badRequest('id is required')

  const updates = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.done !== undefined) updates.done = body.done
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.estimated_minutes !== undefined) updates.estimated_minutes = body.estimated_minutes
  if (body.deadline !== undefined) updates.deadline = body.deadline

  const db = createServiceClient()
  const { data, error } = await db
    .from('tasks')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ task: data })
}

export async function DELETE(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return badRequest('id query param required')

  const db = createServiceClient()
  const { error } = await db
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) return serverError(error.message)
  return Response.json({ success: true })
}
