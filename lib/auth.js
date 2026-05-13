import { createAnonClient } from './supabase-server'

export async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 }
  }

  const token = authHeader.slice(7)
  const supabase = createAnonClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { error: 'Invalid or expired token', status: 401 }
  }

  return { user, supabase }
}

export function unauthorized(message = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 })
}

export function badRequest(message) {
  return Response.json({ error: message }, { status: 400 })
}

export function serverError(message = 'Internal server error') {
  return Response.json({ error: message }, { status: 500 })
}
