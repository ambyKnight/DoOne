import { useEffect } from 'react'
import { useSuggestionStore } from '../../stores/suggestion'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'
import AlgorithmicOrnament from './AlgorithmicOrnament'

export default function NowCard() {
  const { user } = useAuth()
  const {
    suggestion,
    message,
    loading,
    formattedMessage,
    fetchSuggestion,
    recordAction,
  } = useSuggestionStore()

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (token) fetchSuggestion(token)
    })
  }, [user])

  async function handleAction(action) {
    if (!suggestion || !user) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    recordAction(token, suggestion.type, suggestion.id, action, {
      estimated_minutes: suggestion.duration,
    })
  }

  if (loading) {
    return (
      <section className="panel glass hero-panel" style={{ gridArea: 'hero' }}>
        <div className="hero-eyebrow">thinking...</div>
        <h2 className="hero-title">Deciding what's next</h2>
        <div className="hero-orb" aria-hidden="true" />
      </section>
    )
  }

  if (!suggestion) {
    return (
      <section className="panel glass hero-panel" style={{ gridArea: 'hero' }}>
        <AlgorithmicOrnament variant="stars" seed={42} position="tr" size={140} />
        <div className="hero-eyebrow">all clear</div>
        <h2 className="hero-title">{message || 'Nothing to do right now.'}</h2>
        <div className="hero-meta">Add a task or create a job to get started.</div>
        <div className="hero-orb" aria-hidden="true" />
      </section>
    )
  }

  const displayMessage = formattedMessage ||
    `Work on ${suggestion.title} for ${suggestion.duration} minutes.`

  return (
    <section className="panel glass hero-panel now-card" style={{ gridArea: 'hero' }}>
      <AlgorithmicOrnament variant="arc" seed={suggestion.id?.charCodeAt(0) || 7} position="tr" size={140} />
      <div className="hero-eyebrow">
        do this now · {suggestion.duration} min
      </div>
      <h2 className="hero-title">{suggestion.title}</h2>
      <div className="hero-meta">{displayMessage}</div>
      {suggestion.job_title && (
        <div className="hero-meta muted" style={{ fontSize: 12, marginTop: 2 }}>
          part of {suggestion.job_title}
          {suggestion.progress && ` · ${suggestion.progress.completed}/${suggestion.progress.total} done`}
        </div>
      )}
      <div className="now-card-actions">
        <button className="chip primary" onClick={() => handleAction('done')}>
          Done
        </button>
        <button className="chip" onClick={() => handleAction('skip')}>
          Skip
        </button>
      </div>
      <div className="hero-orb" aria-hidden="true" />
    </section>
  )
}
