import { authenticateRequest, unauthorized, serverError } from '../../../../lib/auth'
import { createServiceClient } from '../../../../lib/supabase-server'

// GET — list user's past AI runs (last 50, newest first).
export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('ai_runs')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return Response.json({ runs: data || [] })
  } catch (e) {
    console.error('[ai/runs]', e)
    return serverError(e.message || 'failed to load runs')
  }
}
