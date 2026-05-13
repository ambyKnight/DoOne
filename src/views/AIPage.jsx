import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'

// Step 2 — AI memory. Every prompt/response logged to ai_runs.
// "Past runs" panel below shows the audit trail. Click row to expand.
export default function AIPage() {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [includeContext, setIncludeContext] = useState(true)
  const [contextText, setContextText] = useState('')
  const [contextLoading, setContextLoading] = useState(false)
  const [runs, setRuns] = useState([])
  const [expandedRun, setExpandedRun] = useState(null)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  async function refreshContext() {
    if (!user) return
    setContextLoading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('no session token')
      const res = await fetch('/api/ai/chat/context', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setContextText(json.text || '')
    } catch (e) { setError(e.message) }
    finally { setContextLoading(false) }
  }

  async function refreshRuns() {
    if (!user) return
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/ai/runs', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok) setRuns(json.runs || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => { refreshContext(); refreshRuns() }, [user])

  async function send() {
    if (!prompt.trim() || !user || loading) return
    setLoading(true)
    setError(null)
    setOutput('')
    setUsage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('no session token')
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, includeContext }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setOutput(json.text || '')
      setUsage(json.usage || null)
      if (json.contextText) setContextText(json.contextText)
      refreshRuns()  // pull updated log
    } catch (e) {
      setError(e.message)
      refreshRuns()  // log row exists even on failure
    } finally {
      setLoading(false)
    }
  }

  function fmtTs(iso) {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">ai · step 2</div>
          <h1 className="page-title">AI test</h1>
          <div className="page-sub">
            context + memory. every call is logged below.
          </div>
        </div>
      </header>

      <section className="panel glass">
        <div className="panel-head">
          <h3>Context AI sees</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
              <input type="checkbox" checked={includeContext} onChange={e => setIncludeContext(e.target.checked)} />
              include
            </label>
            <button className="chip" onClick={refreshContext} disabled={contextLoading}>
              {contextLoading ? '…' : 'refresh'}
            </button>
          </div>
        </div>
        <pre style={{
          whiteSpace: 'pre-wrap', margin: 0, marginTop: 8, maxHeight: 320, overflow: 'auto',
          fontSize: 12, fontFamily: 'ui-monospace, monospace',
          opacity: includeContext ? 1 : 0.4,
        }}>
          {contextText || '(empty — refresh to load)'}
        </pre>
      </section>

      <section className="panel glass" style={{ marginTop: 12 }}>
        <div className="panel-head"><h3>Prompt</h3></div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="ask anything about your day, tasks, patterns…"
          rows={5}
          style={{ width: '100%', resize: 'vertical' }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span className="muted small">Ctrl/⌘+Enter to send</span>
          <button className="chip primary" onClick={send} disabled={loading || !prompt.trim()}>
            {loading ? 'thinking…' : 'send'}
          </button>
        </div>
      </section>

      {error && (
        <section className="panel glass" style={{ marginTop: 12 }}>
          <div className="panel-head"><h3 style={{ color: 'crimson' }}>Error</h3></div>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{error}</pre>
        </section>
      )}

      {output && (
        <section className="panel glass" style={{ marginTop: 12 }}>
          <div className="panel-head">
            <h3>Response</h3>
            {usage && (
              <span className="muted small">
                in {usage.promptTokenCount} · out {usage.candidatesTokenCount} · total {usage.totalTokenCount}
              </span>
            )}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{output}</pre>
        </section>
      )}

      {/* Past runs — memory audit trail */}
      <section className="panel glass" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <h3>Past runs</h3>
          <span className="muted small">{runs.length} logged</span>
        </div>
        {runs.length === 0 ? (
          <div className="muted small" style={{ marginTop: 8 }}>(no runs yet — send a prompt above)</div>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {runs.map(r => {
              const isOpen = expandedRun === r.id
              const totalTok = r.usage?.totalTokenCount ?? '—'
              const failed = !!r.error
              return (
                <li key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
                  <button
                    onClick={() => setExpandedRun(isOpen ? null : r.id)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'transparent', border: 0,
                      cursor: 'pointer', color: 'inherit', padding: '4px 0',
                      display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13,
                    }}
                  >
                    <span className="muted small" style={{ minWidth: 60 }}>{fmtTs(r.created_at)}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {failed && <span style={{ color: 'crimson' }}>✗ </span>}
                      {r.prompt}
                    </span>
                    <span className="muted small">{totalTok}tok · {r.duration_ms}ms</span>
                    <span className="muted small">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ paddingLeft: 68, paddingBottom: 8, fontSize: 12 }}>
                      <details style={{ marginTop: 4 }}>
                        <summary className="muted small" style={{ cursor: 'pointer' }}>context sent</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', margin: '4px 0', fontFamily: 'ui-monospace, monospace' }}>
                          {r.context_text || '(none)'}
                        </pre>
                      </details>
                      <div style={{ marginTop: 6 }}>
                        <div className="muted small">response</div>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0', fontFamily: 'inherit' }}>
                          {r.error ? `ERROR: ${r.error}` : (r.response_text || '(empty)')}
                        </pre>
                      </div>
                      {r.tools_called?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div className="muted small">tools called</div>
                          <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0', fontFamily: 'ui-monospace, monospace' }}>
                            {JSON.stringify(r.tools_called, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
