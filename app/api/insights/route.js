import { authenticateRequest, unauthorized, serverError } from '../../../lib/auth'
import { createServiceClient } from '../../../lib/supabase-server'

export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('insights')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('period_end', { ascending: false })
    .limit(10)

  if (error) return serverError(error.message)
  return Response.json({ insights: data })
}
