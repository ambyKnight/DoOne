import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../../lib/auth'
import { createServiceClient } from '../../../../lib/supabase-server'
import { getGeminiClient, DEFAULT_MODEL } from '../../../../lib/gemini'
import { buildContext } from '../../../../lib/aiContext'

const SYSTEM = `You are an assistant embedded in a daily-planner app.
You can see the user's events, tasks, jobs, journal entries, and your own past insights.
Be concise. Speak like a thoughtful friend, not a corporate bot.
If context is thin, say so — don't invent facts.
You cannot perform actions yet (no tools); only observe and advise.`

// Body: { prompt, includeContext?, trigger? }
// Returns: { runId, text, model, usage, contextText? }
export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  let body
  try { body = await request.json() } catch { return badRequest('invalid JSON body') }
  const prompt = (body?.prompt || '').toString().trim()
  if (!prompt) return badRequest('prompt is required')
  if (prompt.length > 8000) return badRequest('prompt too long (max 8000 chars)')
  const includeContext = body?.includeContext !== false
  const trigger = (body?.trigger || 'manual').toString().slice(0, 32)

  const db = createServiceClient()
  const t0 = Date.now()

  let contextText = null
  if (includeContext) {
    try {
      const { text } = await buildContext(db, auth.user.id)
      contextText = text
    } catch (e) {
      console.error('[ai/chat] context build failed, sending without:', e)
    }
  }

  const fullPrompt = contextText
    ? `${SYSTEM}\n\n${contextText}\n\n---\n# User question\n${prompt}`
    : `${SYSTEM}\n\n# User question\n${prompt}`

  let responseText = null
  let usage = null
  let errMsg = null

  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL })
    const result = await model.generateContent(fullPrompt)
    responseText = result.response.text()
    usage = result.response.usageMetadata || null
  } catch (e) {
    console.error('[ai/chat]', e)
    errMsg = e.message || 'Gemini call failed'
  }

  // Log run (success OR failure). Don't block response on log errors.
  let runId = null
  try {
    const { data: row } = await db.from('ai_runs').insert({
      user_id: auth.user.id,
      trigger,
      prompt,
      context_text: contextText,
      response_text: responseText,
      model: DEFAULT_MODEL,
      usage,
      duration_ms: Date.now() - t0,
      error: errMsg,
    }).select('id').single()
    runId = row?.id || null
  } catch (e) {
    console.error('[ai/chat] log insert failed:', e)
  }

  if (errMsg) return Response.json({ error: errMsg, runId }, { status: 500 })
  return Response.json({ runId, text: responseText, model: DEFAULT_MODEL, usage, contextText })
}
