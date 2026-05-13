import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usernameToEmail } from '../lib/authContext'
import AvatarUpload, { uploadAvatar } from '../components/AvatarUpload'

const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/

export default function AuthGate({ wallpaper }) {
  const [tab, setTab] = useState('login')

  return (
    <div className="auth-gate">
      <div
        className="wallpaper"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <div className="wallpaper-veil" />

      <div className="auth-shell glass">
        <div className="auth-brand">d.</div>
        <h1 className="auth-title">DoOne</h1>
        <p className="auth-sub">a quieter way to plan the day</p>

        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'on' : ''}
            onClick={() => setTab('login')}
          >Log in</button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            className={tab === 'signup' ? 'on' : ''}
            onClick={() => setTab('signup')}
          >Sign up</button>
        </div>

        {tab === 'login' ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  )
}

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const u = username.trim().toLowerCase()
    if (!u || !password) { setError('Username and password are required.'); return }
    setBusy(true)
    const { error: e1 } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(u),
      password,
    })
    setBusy(false)
    if (e1) setError('Username or password is incorrect.')
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        <span>Username</span>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </label>
      <label>
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="auth-error">{error}</div>}
      <button className="chip primary auth-submit" disabled={busy} type="submit">
        {busy ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  )
}

function SignupForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)

  function validateLocal() {
    const u = username.trim().toLowerCase()
    if (!USERNAME_RE.test(u)) return 'Username: 3–30 chars, lowercase letters, digits, _ . -'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirm) return 'Passwords don’t match.'
    return null
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setWarning(null)
    const err = validateLocal()
    if (err) { setError(err); return }
    const u = username.trim().toLowerCase()

    setBusy(true)
    // Pre-check username availability (the unique constraint is the real authority).
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', u).maybeSingle()
    if (existing) { setBusy(false); setError('That username is taken.'); return }

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: usernameToEmail(u),
      password,
      options: { data: { username: u } },
    })
    if (signUpErr) {
      setBusy(false)
      if (signUpErr.code === '23505' || /unique|duplicate/i.test(signUpErr.message)) {
        setError('That username is taken.')
      } else {
        setError(signUpErr.message || 'Sign-up failed.')
      }
      return
    }

    // If we have a file and an authenticated user, upload it now.
    const newUser = data?.user
    if (newUser && avatarFile) {
      try {
        const url = await uploadAvatar(newUser.id, avatarFile)
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', newUser.id)
      } catch (e) {
        // Non-fatal — account exists; user can re-upload in Settings.
        setWarning('Account ready, but avatar upload failed. You can try again in Settings.')
      }
    }
    setBusy(false)
    // onAuthStateChange in AuthProvider takes over from here.
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <AvatarUpload
        size={86}
        name={username || 'you'}
        onPicked={setAvatarFile}
      />
      <label>
        <span>Username</span>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          autoComplete="username"
          placeholder="3–30 chars · a-z 0-9 _ . -"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </label>
      <label>
        <span>Password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </label>
      <label>
        <span>Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
      </label>
      {error && <div className="auth-error">{error}</div>}
      {warning && <div className="auth-error warn">{warning}</div>}
      <button className="chip primary auth-submit" disabled={busy} type="submit">
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <div className="auth-hint">avatar is optional — you can add it later in Settings.</div>
    </form>
  )
}
