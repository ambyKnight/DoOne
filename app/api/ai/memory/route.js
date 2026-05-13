import { authenticateRequest, unauthorized, serverError } from '../../../../lib/auth'
import { createServiceClient } from '../../../../lib/supabase-server'
import { getAnthropicClient } from '../../../../lib/anthropic'

// Memory Agent — summarizes behavior patterns into human text
export async function POST(request) {
  const auth = await authenticateRequest(request)
  if (auth.error) return unauthorized(auth.error)

  const db = createServiceClient()
  const { data: patterns } = await db
    .from('behavior_memory')
    .select('*')
    .eq('user_id', auth.user.id)

  if (!patterns?.length) {
    return Response.json({ message: 'No behavior data to summarize yet' })
  }

  try {
    const ai = getAnthropicClient()
    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You summarize user behavior patterns into 2-3 short, useful observations.
Each observation is one sentence. Be specific about times and patterns.
Return each observation on its own line. No bullets, no numbers.`,
      messages: [{
        role: 'user',
        content: `Behavior data:\n${JSON.stringify(patterns.map(p => ({ type: p.pattern_type, data: p.pattern_data })), null, 2)}`,
      }],
    })

    const summaries = response.content[0].text.trim().split('\n').filter(Boolean)

    // Store summaries back
    for (const p of patterns) {
      const matchingSummary = summaries.find(s =>
        s.toLowerCase().includes(p.pattern_type.replace('_', ' ').split('_')[0])
      ) || summaries[0]

      await db.from('behavior_memory').update({
        summary_text: matchingSummary,
        updated_at: new Date().toISOString(),
      }).eq('id', p.id)
    }

    return Response.json({ summaries })
  } catch (e) {
    console.error('[ai/memory]', e)
    return Response.json({ summaries: [], fallback: true })
  }
}
