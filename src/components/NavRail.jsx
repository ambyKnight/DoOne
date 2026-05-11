import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'
import Avatar from './Avatar'

export default function NavRail({ page, setPage }) {
  const { profile } = useAuth()

  return (
    <nav className="nav-rail glass">
      <button
        className="nav-avatar"
        onClick={() => setPage('settings')}
        title={profile?.username ? `signed in as ${profile.username}` : 'account'}
      >
        <Avatar src={profile?.avatar_url} name={profile?.username} size={36} />
      </button>
      <div className="nav-divider" />
      <div className="nav-items">
        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'is-active' : ''}`}
            onClick={() => setPage(id)}
            aria-label={label}
          >
            <Icon width="22" height="22" />
            <span className="nav-tip">{label}</span>
          </button>
        ))}
      </div>
      <div className="nav-foot">
        <button
          className="nav-item nav-logout"
          onClick={() => supabase.auth.signOut()}
          aria-label="Log out"
          title="Log out"
        >
          <LogoutIcon width="22" height="22" />
          <span className="nav-tip">Log out</span>
        </button>
      </div>
    </nav>
  )
}

export const NAV = [
  { id: 'home',     icon: HomeIcon,     label: 'Home'     },
  { id: 'calendar', icon: CalIcon,      label: 'Calendar' },
  { id: 'journal',  icon: JournalIcon,  label: 'Journal'  },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
]

function HomeIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>
}
function CalIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
}
function JournalIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 4h11a3 3 0 0 1 3 3v13a0 0 0 0 1 0 0H8a3 3 0 0 1-3-3z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>
}
function SettingsIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
}
function LogoutIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
}
