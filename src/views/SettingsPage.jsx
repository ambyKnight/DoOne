import { useState, useEffect } from 'react'
import { FONTS, VIBE_PRESETS, SURFACE_PRESETS, ensureFontLoaded } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/authContext'
import VibeIcon from '../components/VibeIcon'
import AvatarUpload from '../components/AvatarUpload'
import WallpaperGrid from '../components/WallpaperGrid'
const defaultWallpaper = '/wallpaper.webp'

// Algorithmic theme palette — curated hues × lightness steps, plus a row
// of neutrals. Kept compact so the panel sits flush with neighbours.
const THEME_HUES = [10, 35, 50, 140, 200, 270, 320]
const THEME_STEPS = [
  { s: 40, l: 92 },
  { s: 65, l: 80 },
  { s: 80, l: 66 },
  { s: 88, l: 52 },
  { s: 76, l: 38 },
  { s: 56, l: 22 },
]
const THEME_NEUTRALS = [97, 84, 68, 52, 32, 12].map(l => `hsl(0, 0%, ${l}%)`)
const THEME_PALETTE = [
  ...THEME_HUES.flatMap(h => THEME_STEPS.map(({ s, l }) => `hsl(${h}, ${s}%, ${l}%)`)),
  ...THEME_NEUTRALS,
]

export default function SettingsPage({
  font, setFont,
  vibe, setVibe,
  surface, setSurface,
  density, setDensity,
  vibeDials, setVibeDial, resetVibe,
  surfaceDials, setSurfaceDial, resetSurface,
  accentBoost, setAccentBoost,
  blurAmount, setBlurAmount,
  surfaceAlpha, setSurfaceAlpha,
  panelGap, setPanelGap,
  repalette, prefId,
  wallpaper, setWallpaper,
  wallpaperOff, setWallpaperOff,
  lastPalette,
  isMobile,
}) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  // When Settings opens, eagerly load every font face so the previews show
  // their actual look. Idempotent — each face is fetched at most once.
  useEffect(() => {
    FONTS.forEach(f => ensureFontLoaded(f.id))
  }, [])

  // shallow-compare current dials against a preset's dials (epsilon for floats)
  const isModified = (curr, preset, eps = 0.001) =>
    Object.keys(preset).some(k => Math.abs((curr[k] ?? 0) - preset[k]) > eps)
  const vibeModified = isModified(vibeDials, VIBE_PRESETS[vibe] || {})
  const surfaceModified = isModified(surfaceDials, SURFACE_PRESETS[surface] || {})

  async function savePrefs() {
    if (!user) return
    setSaving(true)
    const payload = {
      font, vibe, surface, density,
      vibe_dials: vibeDials,
      surface_dials: surfaceDials,
      accent_boost: accentBoost,
      blur_amount: blurAmount,
      surface_alpha: surfaceAlpha,
      panel_gap: panelGap,
      updated_at: new Date().toISOString(),
    }
    if (prefId) {
      await supabase.from('user_preferences').update(payload).eq('id', prefId)
    } else {
      await supabase.from('user_preferences').insert({ ...payload, user_id: user.id })
    }
    setSaving(false)
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">preferences</div>
          <h1 className="page-title">Settings</h1>
        </div>
        <div className="header-tools">
          <button className="chip primary" onClick={savePrefs} disabled={saving}>
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </header>

      <div className="settings-grid">
        {/* Vibe */}
        <section className="panel glass">
          <div className="panel-head"><h3>Vibe</h3><span className="muted">overall mood</span></div>
          <div className="preset-row">
            {['calm','vivid','luminous','mono'].map(v => (
              <button key={v} className={`preset-card vibe-preview vibe-${v} ${vibe === v ? 'on' : ''}`} onClick={() => setVibe(v)} aria-pressed={vibe === v}>
                <VibeIcon variant={v} />
                <span className="preset-name">{v}</span>
                {vibe === v && vibeModified && <span className="preset-modified">modified</span>}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>click a preset again to reset its dials in Atelier.</p>
        </section>

        {/* Surface */}
        <section className="panel glass settings-surface">
          <div className="panel-head"><h3>Surface</h3><span className="muted">window material</span></div>
          <div className="preset-row">
            {['glass','paper','solid','sheer'].map(s => (
              <button key={s} className={`preset-card surface-preview surface-${s} ${surface === s ? 'on' : ''}`} onClick={() => setSurface(s)} aria-pressed={surface === s}>
                <span className="preset-sheet" />
                <span className="preset-name">{s}</span>
                {surface === s && surfaceModified && <span className="preset-modified">modified</span>}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>click a preset again to reset its dials in Atelier.</p>
        </section>

        {/* Density */}
        <section className="panel glass settings-density">
          <div className="panel-head"><h3>Density</h3><span className="muted">spacing &amp; scale</span></div>
          <div className="preset-row">
            {[['airy','open + roomy'],['cozy','balanced'],['packed','compact']].map(([id, note]) => {
              const cols = id === 'airy' ? 3 : id === 'cozy' ? 4 : 6
              return (
                <button key={id} title={note} className={`preset-card density-preview density-${id} ${density === id ? 'on' : ''}`} onClick={() => setDensity(id)} aria-pressed={density === id}>
                  <span className="density-art" aria-hidden="true">
                    {Array.from({ length: cols * cols }).map((_, i) => <span key={i} />)}
                  </span>
                  <span className="preset-name">{id}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Theme — glass base color picker, algorithmic palette */}
        <section className="panel glass">
          <div className="panel-head">
            <h3>Theme</h3>
            <span className="muted">glass base color</span>
          </div>
          <button
            className="btn ghost full"
            onClick={() => {
              if (!lastPalette) return
              // soft but visible tint of wallpaper's dominant hue
              const h = lastPalette.domH ?? 0
              const tinted = `hsl(${h}, 55%, 86%)`
              setSurfaceDial('baseColor', tinted)
            }}
            disabled={!lastPalette}
            style={{ marginBottom: 10 }}
          >
            ↻ auto from wallpaper
          </button>
          <div className="theme-grid" role="radiogroup" aria-label="Glass base color">
            {THEME_PALETTE.map(c => {
              const current = (surfaceDials.baseColor ?? '#ffffff').toLowerCase()
              const active = c.toLowerCase() === current
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={c}
                  className={`theme-swatch ${active ? 'on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setSurfaceDial('baseColor', c)}
                />
              )
            })}
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            current · <code style={{ fontFamily: 'ui-monospace, monospace' }}>{surfaceDials.baseColor ?? '#ffffff'}</code>
          </div>
        </section>

        {/* Typography */}
        <section className="panel glass">
          <div className="panel-head"><h3>Typography</h3><span className="muted">choose a font</span></div>
          <div className="font-pick">
            {FONTS.map(f => (
              <button key={f.id} className={`font-card ${font === f.id ? 'on' : ''}`} onClick={() => setFont(f.id)} style={{ fontFamily: f.stack }}>
                <div>
                  <div className="font-name">{f.name}</div>
                  <div className="font-note">{f.note}</div>
                </div>
                <div className="font-spec">Aa 1 2 3</div>
              </button>
            ))}
          </div>
        </section>

        {/* Atelier — single source of truth for every renderer dial.
            Vibe/Surface presets above just write bundles of these. Hidden on mobile. */}
        {!isMobile && (
        <section className="panel glass atelier-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head">
            <h3>Atelier</h3>
            <span className="muted">every dial behind the look</span>
          </div>

          <div className="atelier-grid">
            <div className="atelier-group">
              <div className="atelier-group-label">glow &amp; mood</div>
              <div className="setting-row"><label>Saturation × {vibeDials.satMult.toFixed(2)}
                <input type="range" min="0" max="2" step="0.05" value={vibeDials.satMult}
                  onChange={e => setVibeDial('satMult', +e.target.value)} /></label></div>
              <div className="setting-row"><label>Glow alpha · {Math.round(vibeDials.glowAlpha * 100)}%
                <input type="range" min="0" max="0.6" step="0.02" value={vibeDials.glowAlpha}
                  onChange={e => setVibeDial('glowAlpha', +e.target.value)} /></label></div>
              <div className="setting-row"><label>Glow blur · {vibeDials.glowBlur}px
                <input type="range" min="20" max="160" step="5" value={vibeDials.glowBlur}
                  onChange={e => setVibeDial('glowBlur', +e.target.value)} /></label></div>
              <div className="setting-row"><label>Wallpaper veil · {Math.round(vibeDials.veilAlpha * 100)}%
                <input type="range" min="0" max="0.5" step="0.02" value={vibeDials.veilAlpha}
                  onChange={e => setVibeDial('veilAlpha', +e.target.value)} /></label></div>
            </div>

            <div className="atelier-group atelier-surface">
              <div className="atelier-group-label">surface</div>
              <div className="setting-row"><label>Glass opacity · {Math.round(surfaceAlpha * 100)}% <span className="muted small">({Math.round((1 - surfaceAlpha) * 100)}% transparent)</span>
                <input type="range" min="0" max="1" step="0.02" value={surfaceAlpha}
                  onChange={e => setSurfaceAlpha(+e.target.value)} /></label></div>
              <div className="setting-row"><label>Glass blur · {blurAmount}px
                <input type="range" min="0" max="40" step="1" value={blurAmount}
                  onChange={e => setBlurAmount(+e.target.value)} /></label></div>
            </div>

            <div className="atelier-group atelier-layout">
              <div className="atelier-group-label">layout</div>
              <div className="setting-row"><label>Window gap · {panelGap}px
                <input type="range" min="2" max="36" step="2" value={panelGap}
                  onChange={e => setPanelGap(+e.target.value)} /></label></div>
            </div>
          </div>
        </section>
        )}

        {/* Wallpaper */}
        <section className="panel glass" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head"><h3>Wallpaper</h3><span className="muted">upload &amp; switch</span></div>
          <div className="settings-row" style={{ marginBottom: 12 }}>
            <span>Disable wallpaper</span>
            <button
              type="button"
              className={`switch ${wallpaperOff ? 'on' : ''}`}
              aria-pressed={wallpaperOff}
              onClick={() => setWallpaperOff(!wallpaperOff)}
            ><span className="dot" /></button>
          </div>
          <WallpaperGrid
            activeUrl={wallpaper}
            onSelect={url => setWallpaper(url || defaultWallpaper)}
          />
        </section>

        {/* Account */}
        <AccountPanel />

        {/* Notifications placeholder */}
        <section className="panel glass">
          <div className="panel-head"><h3>Notifications</h3><span className="muted">coming soon</span></div>
          {['Daily digest','Event reminders','Journal nudge'].map((it, i) => (
            <div key={i} className="settings-row">
              <span>{it}</span>
              <span className="switch"><span className="dot" /></span>
            </div>
          ))}
        </section>

      </div>
    </div>
  )
}

function AccountPanel() {
  const { user, profile, refreshProfile } = useAuth()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)
  const [delConfirm, setDelConfirm] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState(null)

  async function changePassword(e) {
    e.preventDefault()
    setPwMsg(null)
    if (pw1.length < 8) { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    if (pw1 !== pw2) { setPwMsg({ ok: false, text: 'Passwords don’t match.' }); return }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setPwBusy(false)
    if (error) {
      setPwMsg({ ok: false, text: error.message })
    } else {
      setPw1(''); setPw2('')
      setPwMsg({ ok: true, text: 'Password updated.' })
    }
  }

  async function onAvatarUploaded(url) {
    if (!user) return
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    await refreshProfile()
  }

  async function deleteAccount() {
    setDelError(null)
    setDelBusy(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDelBusy(false)
      setDelError(error.message)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <section className="panel glass">
      <div className="panel-head"><h3>Account</h3><span className="muted">profile &amp; data</span></div>

      <div className="account-row">
        <AvatarUpload
          userId={user?.id}
          initialUrl={profile?.avatar_url}
          name={profile?.username}
          size={72}
          onUploaded={onAvatarUploaded}
        />
        <div className="account-id">
          <div className="muted small">username</div>
          <div className="account-username">{profile?.username || '—'}</div>
        </div>
      </div>

      <form className="account-form" onSubmit={changePassword}>
        <div className="muted small" style={{ marginTop: 10 }}>change password</div>
        <input
          type="password"
          placeholder="new password (≥ 8 chars)"
          autoComplete="new-password"
          value={pw1}
          onChange={e => setPw1(e.target.value)}
        />
        <input
          type="password"
          placeholder="confirm new password"
          autoComplete="new-password"
          value={pw2}
          onChange={e => setPw2(e.target.value)}
        />
        <button className="chip" type="submit" disabled={pwBusy || !pw1}>
          {pwBusy ? 'Updating…' : 'Update password'}
        </button>
        {pwMsg && <div className={`auth-error ${pwMsg.ok ? 'ok' : ''}`}>{pwMsg.text}</div>}
      </form>

      <div className="account-actions">
        <button className="chip" onClick={() => supabase.auth.signOut()}>Log out</button>
        {!delConfirm ? (
          <button className="chip danger" onClick={() => setDelConfirm(true)}>Delete account</button>
        ) : (
          <div className="account-delete-confirm">
            <span className="muted small">this wipes events, journal, prefs, avatar. can't undo.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="chip" onClick={() => setDelConfirm(false)} disabled={delBusy}>cancel</button>
              <button className="chip danger" onClick={deleteAccount} disabled={delBusy}>
                {delBusy ? 'Deleting…' : 'yes, delete'}
              </button>
            </div>
            {delError && <div className="auth-error">{delError}</div>}
          </div>
        )}
      </div>
    </section>
  )
}
