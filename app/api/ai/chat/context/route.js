import { authenticateRequest, unauthorized, serverError } from '../../../../../lib/auth'
import { createServiceClient } from '../../../../../lib/supabase-server'
import { buildContext } from '../../../../../lib/aiContext'

// GET — preview the exact context that would be sent to the AI.
// Returns { bundle, text }. No AI call. Cheap.
export async function GET(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)
  try {
    const db = createServiceClient()
    const { bundle, text } = await buildContext(db, auth.user.id)
    return Response.json({ bundle, text })
  } catch (e) {
    console.error('[ai/chat/context]', e)
    return serverError(e.message || 'context build failed')
  }
}
