import { useState } from 'react'
import { FONTS, VIBE_PRESETS, SURFACE_PRESETS } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'
import LowPolyWallpaper from '../components/LowPolyWallpaper'
import VibeIcon from '../components/VibeIcon'

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
}) {
  const [showAdvVibe, setShowAdvVibe] = useState(false)
  const [showAdvSurface, setShowAdvSurface] = useState(false)
  const [saving, setSaving] = useState(false)

  async function savePrefs() {
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
      await supabase.from('user_preferences').insert(payload)
    }
    setSaving(false)
  }

  const exportPrefs = () => ({ font, vibe, surface, density, vibeDials, surfaceDials, accentBoost, blurAmount, surfaceAlpha, panelGap })

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
              <button key={v} className={`preset-card vibe-preview vibe-${v} ${vibe === v ? 'on' : ''}`} onClick={() => setVibe(v)}>
                <VibeIcon variant={v} />
                <span className="preset-name">{v}</span>
              </button>
            ))}
          </div>
          <button className="adv-toggle" onClick={() => setShowAdvVibe(s => !s)}>
            <span className={`adv-arrow ${showAdvVibe ? 'open' : ''}`}>▸</span> advanced dials
          </button>
          <div className={`adv-dials ${showAdvVibe ? 'open' : ''}`}><div>
            <div className="setting-row"><label>Saturation × {vibeDials.satMult.toFixed(2)}<input type="range" min="0" max="2" step="0.05" value={vibeDials.satMult} onChange={e => setVibeDial('satMult', +e.target.value)} /></label></div>
            <div className="setting-row"><label>Glow alpha · {Math.round(vibeDials.glowAlpha * 100)}%<input type="range" min="0" max="0.6" step="0.02" value={vibeDials.glowAlpha} onChange={e => setVibeDial('glowAlpha', +e.target.value)} /></label></div>
            <div className="setting-row"><label>Glow blur · {vibeDials.glowBlur}px<input type="range" min="20" max="160" step="5" value={vibeDials.glowBlur} onChange={e => setVibeDial('glowBlur', +e.target.value)} /></label></div>
            <div className="setting-row"><label>Wallpaper veil · {Math.round(vibeDials.veilAlpha * 100)}%<input type="range" min="0" max="0.5" step="0.02" value={vibeDials.veilAlpha} onChange={e => setVibeDial('veilAlpha', +e.target.value)} /></label></div>
            <button className="btn ghost full" onClick={resetVibe}>↻ reset to "{vibe}"</button>
          </div></div>
        </section>

        {/* Surface */}
        <section className="panel glass">
          <div className="panel-head"><h3>Surface</h3><span className="muted">window material</span></div>
          <div className="preset-row">
            {['glass','paper','solid','sheer'].map(s => (
              <button key={s} className={`preset-card surface-preview surface-${s} ${surface === s ? 'on' : ''}`} onClick={() => setSurface(s)}>
                <span className="preset-sheet" />
                <span className="preset-name">{s}</span>
              </button>
            ))}
          </div>
          <button className="adv-toggle" onClick={() => setShowAdvSurface(s => !s)}>
            <span className={`adv-arrow ${showAdvSurface ? 'open' : ''}`}>▸</span> advanced dials
          </button>
          <div className={`adv-dials ${showAdvSurface ? 'open' : ''}`}><div>
            <div className="setting-row"><label>Opacity × {surfaceDials.alphaMult.toFixed(2)}<input type="range" min="0.2" max="2.5" step="0.05" value={surfaceDials.alphaMult} onChange={e => setSurfaceDial('alphaMult', +e.target.value)} /></label></div>
            <div className="setting-row"><label>Blur · {surfaceDials.blur}px<input type="range" min="0" max="40" step="1" value={surfaceDials.blur} onChange={e => setSurfaceDial('blur', +e.target.value)} /></label></div>
            <div className="setting-row"><label>Stroke × {surfaceDials.strokeMult.toFixed(2)}<input type="range" min="0" max="2" step="0.05" value={surfaceDials.strokeMult} onChange={e => setSurfaceDial('strokeMult', +e.target.value)} /></label></div>
            <div className="setting-row"><label>Shadow × {surfaceDials.shadowMult.toFixed(2)}<input type="range" min="0" max="2" step="0.05" value={surfaceDials.shadowMult} onChange={e => setSurfaceDial('shadowMult', +e.target.value)} /></label></div>
            <button className="btn ghost full" onClick={resetSurface}>↻ reset to "{surface}"</button>
          </div></div>
        </section>

        {/* Density */}
        <section className="panel glass">
          <div className="panel-head"><h3>Density</h3><span className="muted">spacing &amp; scale</span></div>
          <div className="preset-row">
            {[['airy','open + roomy'],['cozy','balanced'],['packed','compact']].map(([id, note]) => {
              // algorithmic dot field — count derives from grid columns squared
              const cols = id === 'airy' ? 3 : id === 'cozy' ? 4 : 6
              return (
                <button key={id} className={`preset-card density-preview density-${id} ${density === id ? 'on' : ''}`} onClick={() => setDensity(id)}>
                  <span className="density-art" aria-hidden="true">
                    {Array.from({ length: cols * cols }).map((_, i) => <span key={i} />)}
                  </span>
                  <span className="preset-name">{id}</span>
                  <span className="muted" style={{ fontSize: 10 }}>{note}</span>
                </button>
              )
            })}
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

        {/* Glass */}
        <section className="panel glass">
          <div className="panel-head"><h3>Glass</h3><span className="muted">surface feel</span></div>
          <div className="setting-row"><label>Blur strength · {blurAmount}px<input type="range" min="4" max="40" step="2" value={blurAmount} onChange={e => setBlurAmount(+e.target.value)} /></label></div>
          <div className="setting-row"><label>Surface opacity · {Math.round(surfaceAlpha * 100)}%<input type="range" min="0.2" max="0.9" step="0.05" value={surfaceAlpha} onChange={e => setSurfaceAlpha(+e.target.value)} /></label></div>
          <div className="setting-row"><label>Window gap · {panelGap}px<input type="range" min="4" max="36" step="2" value={panelGap} onChange={e => setPanelGap(+e.target.value)} /></label></div>
        </section>

        {/* Wallpaper */}
        <section className="panel glass">
          <div className="panel-head"><h3>Wallpaper</h3><span className="muted">cherry blossom</span></div>
          <div className="wp-preview">
            <LowPolyWallpaper src={wallpaper} cols={48} rows={27} />
          </div>
          <button className="btn ghost full" onClick={repalette}>↻ extract colour from wallpaper</button>
          <div className="muted small" style={{ marginTop: 8 }}>drag-and-drop your own wallpaper · coming soon</div>
        </section>

        {/* Account placeholder */}
        <section className="panel glass">
          <div className="panel-head"><h3>Account</h3><span className="muted">profile &amp; data</span></div>
          {['Profile & name','Email / password','Export data'].map((it, i) => (
            <div key={i} className="settings-row"><span>{it}</span><span className="muted">›</span></div>
          ))}
        </section>

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

        {/* Sync payload */}
        <section className="panel glass" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head"><h3>Sync preferences</h3><span className="muted">JSON — ready for database</span></div>
          <pre className="json-dump">{JSON.stringify(exportPrefs(), null, 2)}</pre>
          <div className="setting-row" style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(JSON.stringify(exportPrefs(), null, 2))}>copy JSON</button>
            <span className="muted small" style={{ alignSelf: 'center' }}>this is what gets saved to your database</span>
          </div>
        </section>
      </div>
    </div>
  )
}
