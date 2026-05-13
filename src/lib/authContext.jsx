import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthCtx = createContext({ user: null, profile: null, loading: true })

const USERNAME_DOMAIN = 'doone.local'
export const usernameToEmail = u => `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep the user object reference STABLE across token-refresh events.
      // Supabase emits TOKEN_REFRESHED periodically (and on tab focus / network
      // changes) with a brand-new session object; if we naively replace `user`
      // we cause every downstream effect keyed off `user` to re-run, which in
      // App.jsx triggers a fresh `applyPrefRow` that wipes any unsaved local
      // pref changes. Only swap the reference when the actual user identity
      // changes (sign-in, sign-out, account switch).
      const next = session?.user ?? null
      setUser(prev => (prev?.id === next?.id ? prev : next))
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Fetch profile whenever the user changes. Clear it on sign-out.
  useEffect(() => {
    if (!user) { setProfile(null); return }
    let cancelled = false
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setProfile(data) })
    return () => { cancelled = true }
  }, [user])

  async function refreshProfile() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(data)
  }

  return (
    <AuthCtx.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
