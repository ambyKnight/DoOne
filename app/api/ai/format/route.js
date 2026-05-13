import { authenticateRequest, unauthorized, badRequest, serverError } from '../../../../lib/auth'
import { getAnthropicClient } from '../../../../lib/anthropic'

// Formatter Agent — turns suggestion data into human-friendly message
export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const body = await request.json()
  if (!body.title) return badRequest('title is required')

  try {
    const ai = getAnthropicClient()
    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You format task suggestions into short, calm, human messages.
One sentence. No emojis. Not robotic. Warm but direct.
Return ONLY the message text, nothing else.`,
      messages: [{
        role: 'user',
        content: `Item: ${body.title}
Duration: ${body.duration || 30} minutes
Reason: ${body.reason || 'best match'}
${body.progress ? `Progress: ${body.progress.completed}/${body.progress.total} sessions done` : ''}
${body.job_title ? `Part of: ${body.job_title}` : ''}`,
      }],
    })

    return Response.json({ message: response.content[0].text.trim() })
  } catch (e) {
    console.error('[ai/format]', e)
    // Fallback — no AI needed
    const dur = body.duration || 30
    let msg = `Work on ${body.title} for ${dur} minutes.`
    if (body.reason) msg += ` ${body.reason.charAt(0).toUpperCase() + body.reason.slice(1)}.`
    return Response.json({ message: msg, fallback: true })
  }
}
