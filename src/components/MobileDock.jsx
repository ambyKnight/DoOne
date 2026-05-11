import { NAV } from './NavRail'

export default function MobileDock({ page, setPage }) {
  return (
    <nav className="mobile-dock glass">
      {NAV.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`dock-item ${page === id ? 'is-active' : ''}`}
          onClick={() => setPage(id)}
          aria-label={label}
        >
          <Icon className="dock-icon" width="22" height="22" />
          <span className="dock-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
