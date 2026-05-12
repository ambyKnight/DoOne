import { useRef, useState } from 'react'
import { NAV } from './NavRail'

export default function MobileDock({ page, setPage }) {
  const [hint, setHint] = useState(null)
  const longTimer = useRef(null)

  function startPress(id) {
    clearTimeout(longTimer.current)
    longTimer.current = setTimeout(() => setHint(id), 380)
  }
  function endPress(id, fire) {
    clearTimeout(longTimer.current)
    setHint(null)
    if (fire) setPage(id)
  }

  return (
    <nav className="mobile-dock glass">
      {NAV.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`dock-item ${page === id ? 'is-active' : ''}`}
          onClick={() => setPage(id)}
          onTouchStart={() => startPress(id)}
          onTouchEnd={() => endPress(id, false)}
          onTouchCancel={() => endPress(id, false)}
          onMouseDown={() => startPress(id)}
          onMouseUp={() => endPress(id, false)}
          onMouseLeave={() => endPress(id, false)}
          aria-label={label}
        >
          <Icon className="dock-icon" width="22" height="22" />
          {hint === id && <span className="dock-tip">{label}</span>}
        </button>
      ))}
    </nav>
  )
}
