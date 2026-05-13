import { authenticateRequest, unauthorized } from './auth'

// Wrap authenticateRequest with admin-UID allowlist check.
// Returns { user, supabase } on success, OR a Response (already a 401/403)
// that the caller should return immediately.
export async function authenticateAdmin(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return { response: unauthorized(auth.error) }
  const allow = (process.env.ADMIN_UIDS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  if (!allow.includes(auth.user.id)) {
    return { response: new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    }) }
  }
  return { user: auth.user }
}
