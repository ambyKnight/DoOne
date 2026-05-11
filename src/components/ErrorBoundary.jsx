import { Component } from 'react'

/**
 * Catches render errors below it instead of crashing the whole app to a white
 * screen. Shows a small inline recovery card. Logs to console for debugging.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, info: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{
        margin: '40px auto',
        maxWidth: 520,
        padding: '24px 28px',
        background: 'rgba(255,255,255,0.85)',
        color: 'hsl(220, 30%, 16%)',
        borderRadius: 18,
        border: '1px solid rgba(40,40,60,0.18)',
        fontFamily: 'Manrope, system-ui, sans-serif',
        boxShadow: '0 12px 32px -10px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 }}>
          something snapped
        </div>
        <h2 style={{ margin: '8px 0 12px', fontSize: 22, fontWeight: 600 }}>
          we hit a render error.
        </h2>
        <pre style={{
          background: 'rgba(0,0,0,0.05)',
          padding: '10px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: 'ui-monospace, monospace',
          overflowX: 'auto',
          margin: 0,
        }}>{String(this.state.error?.message || this.state.error)}</pre>
        <button
          onClick={this.reset}
          style={{
            marginTop: 14,
            padding: '8px 16px',
            borderRadius: 999,
            border: 0,
            cursor: 'pointer',
            background: 'hsl(220, 30%, 16%)',
            color: '#fff',
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >try again</button>
      </div>
    )
  }
}
