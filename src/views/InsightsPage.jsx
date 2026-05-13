import { useEffect } from 'react'
import { useInsightsStore } from '../../stores/insights'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'

export default function InsightsPage() {
  const { user } = useAuth()
  const {
    insights,
    behaviorPatterns,
    loading,
    fetchInsights,
    fetchBehavior,
    generateInsight,
    generateMemorySummaries,
  } = useInsightsStore()

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (token) {
        fetchInsights(token)
        fetchBehavior(token)
      }
    })
  }, [user])

  async function handleGenerate() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      await generateInsight(token)
      await generateMemorySummaries(token)
      await fetchBehavior(token)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">insights</div>
          <h1 className="page-title">Insights</h1>
          <div className="page-sub">your patterns + progress</div>
        </div>
        <div className="header-tools">
          <button className="chip primary" onClick={handleGenerate}>
            Generate weekly insight
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Behavior patterns */}
        {behaviorPatterns.length > 0 && (
          <section className="panel glass">
            <div className="panel-head"><h3>Behavior Patterns</h3></div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {behaviorPatterns.map(p => (
                <li key={p.id}>
                  <div className="muted small" style={{ textTransform: 'capitalize' }}>
                    {p.pattern_type.replace(/_/g, ' ')}
                  </div>
                  {p.summary_text && <div style={{ fontSize: 14, marginTop: 2 }}>{p.summary_text}</div>}
                  {!p.summary_text && (
                    <div className="muted small">
                      {JSON.stringify(p.pattern_data).slice(0, 80)}…
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Weekly insights */}
        {insights.length > 0 ? (
          insights.map(i => (
            <section key={i.id} className="panel glass">
              <div className="panel-head">
                <h3>{i.period_start} → {i.period_end}</h3>
              </div>
              <div style={{ marginTop: 8, lineHeight: 1.6 }}>{i.summary_text}</div>
              {i.stats && (
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }} className="muted">
                  <span>{i.stats.tasksCompleted} tasks</span>
                  <span>{i.stats.sessionsCompleted} sessions</span>
                  <span>best: {i.stats.bestDay}</span>
                </div>
              )}
            </section>
          ))
        ) : (
          <section className="panel glass">
            <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
              No insights yet. Use the app for a week, then generate your first report.
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
