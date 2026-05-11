import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabaseClient'
import { VIBE_PRESETS, SURFACE_PRESETS, DENSITY_PRESETS, FONTS, DEFAULT_PREFS } from './lib/constants'
import { extractPalette, applyPalette } from './lib/palette'
import NavRail from './components/NavRail'
import MobileDock from './components/MobileDock'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import JournalPage from './pages/JournalPage'
import SettingsPage from './pages/SettingsPage'
import defaultWallpaper from './assets/wallpaper.png'

const NAV_ORDER = ['home', 'calendar', 'journal', 'settings']

function toFCEvent(row) {
  return {
    id: row.id,
    title: row.title,
    start: row.start_time,
    end: row.end_time ?? undefined,
    allDay: row.all_day,
    tag: row.tag || 'ev-tag1',
  }
}

export default function App() {
  const [page, setPage] = useState('home')
  const [calView, setCalView] = useState('dayGridMonth')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 880)

  const mainRef = useRef(null)
  const deltaRef = useRef(0)
  const cooldownRef = useRef(false)
  const prefsLoadedRef = useRef(false)
  const prefSaveTimer = useRef(null)
  const prefIdRef = useRef(null)

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])

  const [font, setFont] = useState(DEFAULT_PREFS.font)
  const [vibe, setVibe] = useState(DEFAULT_PREFS.vibe)
  const [surface, setSurface] = useState(DEFAULT_PREFS.surface)
  const [density, setDensity] = useState(DEFAULT_PREFS.density)
  const [vibeDials, setVibeDialsState] = useState({ ...VIBE_PRESETS[DEFAULT_PREFS.vibe] })
  const [surfaceDials, setSurfaceDialsState] = useState({ ...SURFACE_PRESETS[DEFAULT_PREFS.surface] })
  const [accentBoost, setAccentBoost] = useState(DEFAULT_PREFS.accentBoost)
  const [blurAmount, setBlurAmount] = useState(DEFAULT_PREFS.blurAmount)
  const [surfaceAlpha, setSurfaceAlpha] = useState(DEFAULT_PREFS.surfaceAlpha)
  const [panelGap, setPanelGap] = useState(DEFAULT_PREFS.panelGap)
  const [prefId, setPrefId] = useState(null)
  const [lastPalette, setLastPalette] = useState(null)
  const [wallpaper, setWallpaper] = useState(defaultWallpaper)

  function setVibeDial(key, val) {
    setVibeDialsState(prev => ({ ...prev, [key]: val }))
  }
  function resetVibe() {
    setVibeDialsState({ ...VIBE_PRESETS[vibe] })
  }
  function setSurfaceDial(key, val) {
    setSurfaceDialsState(prev => ({ ...prev, [key]: val }))
  }
  function resetSurface() {
    setSurfaceDialsState({ ...SURFACE_PRESETS[surface] })
  }
  async function repalette() {
    try {
      const p = await extractPalette(wallpaper)
      setLastPalette(p)
      applyPalette(p)
    } catch (e) {
      console.error('palette error', e)
    }
  }

  // Wallpaper change → update CSS var + re-extract palette.
  // Lives in its own effect so swapping wallpapers (future drag/drop)
  // re-runs everything that depends on the image.
  useEffect(() => {
    document.documentElement.style.setProperty('--wallpaper-url', `url(${wallpaper})`)
    extractPalette(wallpaper).then(p => {
      setLastPalette(p)
      applyPalette(p)
    }).catch(console.error)
  }, [wallpaper])

  // Mount: data load, realtime subscriptions, resize
  useEffect(() => {
    supabase.from('events').select('*').order('start_time')
      .then(({ data }) => { if (data) setEvents(data.map(toFCEvent)) })

    supabase.from('tasks').select('*').order('created_at')
      .then(({ data }) => { if (data) setTasks(data) })

    supabase.from('user_preferences').select('*').limit(1).maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          prefIdRef.current = data.id
          setPrefId(data.id)
          if (data.font) setFont(data.font)
          if (data.vibe) { setVibe(data.vibe); setVibeDialsState({ ...VIBE_PRESETS[data.vibe] }) }
          if (data.surface) { setSurface(data.surface); setSurfaceDialsState({ ...SURFACE_PRESETS[data.surface] }) }
          if (data.density) setDensity(data.density)
          if (data.vibe_dials) setVibeDialsState(data.vibe_dials)
          if (data.surface_dials) setSurfaceDialsState(data.surface_dials)
          if (data.accent_boost != null) setAccentBoost(data.accent_boost)
          if (data.blur_amount != null) setBlurAmount(data.blur_amount)
          if (data.surface_alpha != null) setSurfaceAlpha(data.surface_alpha)
          if (data.panel_gap != null) setPanelGap(data.panel_gap)
        } else {
          const { data: created } = await supabase.from('user_preferences').insert({}).select().single()
          if (created) { prefIdRef.current = created.id; setPrefId(created.id) }
        }
        prefsLoadedRef.current = true
      })

    const ch = supabase.channel('app-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' },
        ({ new: r }) => setEvents(p => [...p, toFCEvent(r)]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' },
        ({ new: r }) => setEvents(p => p.map(e => e.id === r.id ? toFCEvent(r) : e)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' },
        ({ old: r }) => setEvents(p => p.filter(e => e.id !== r.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' },
        ({ new: r }) => setTasks(p => [...p, r]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' },
        ({ new: r }) => setTasks(p => p.map(t => t.id === r.id ? r : t)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' },
        ({ old: r }) => setTasks(p => p.filter(t => t.id !== r.id)))
      .subscribe()

    const onResize = () => setIsMobile(window.innerWidth < 880)
    window.addEventListener('resize', onResize)
    return () => {
      supabase.removeChannel(ch)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Font → --font
  useEffect(() => {
    const f = FONTS.find(x => x.id === font)
    if (f) document.documentElement.style.setProperty('--font', f.stack)
  }, [font])

  // Vibe dials → CSS vars
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--vibe-sat-mult', vibeDials.satMult)
    r.style.setProperty('--vibe-glow-alpha', vibeDials.glowAlpha)
    r.style.setProperty('--vibe-glow-blur', `${vibeDials.glowBlur}px`)
    r.style.setProperty('--vibe-veil-alpha', vibeDials.veilAlpha)
  }, [vibeDials])

  // Surface dials → CSS vars (blur set here, overridden by blurAmount below)
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--surface-alpha-mult', surfaceDials.alphaMult)
    r.style.setProperty('--blur', `${surfaceDials.blur}px`)
    r.style.setProperty('--stroke-mult', surfaceDials.strokeMult)
    r.style.setProperty('--shadow-mult', surfaceDials.shadowMult)
    r.style.setProperty('--panel-tint', surfaceDials.panelTint ?? 0)
  }, [surfaceDials])

  // Density → CSS vars
  useEffect(() => {
    const d = DENSITY_PRESETS[density]
    const r = document.documentElement
    r.style.setProperty('--panel-pad', `${d.pad}px`)
    r.style.setProperty('--panel-gap', `${d.gap}px`)
    r.style.setProperty('--type-scale', d.scale)
    r.style.setProperty('--rad', `${d.radius}px`)
  }, [density])

  // Accent boost
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-boost', accentBoost)
  }, [accentBoost])

  // Glass section blur override (wins over surfaceDials.blur)
  useEffect(() => {
    document.documentElement.style.setProperty('--blur', `${blurAmount}px`)
  }, [blurAmount])

  // Glass section surface opacity override (wins over surfaceDials.alphaMult)
  useEffect(() => {
    document.documentElement.style.setProperty('--surface-alpha-mult', surfaceAlpha)
  }, [surfaceAlpha])

  // Panel gap override
  useEffect(() => {
    document.documentElement.style.setProperty('--panel-gap', `${panelGap}px`)
  }, [panelGap])

  // Scroll-snap page navigation (desktop)
  useEffect(() => {
    if (isMobile) return
    const THRESHOLD = 420
    const COOLDOWN = 1100
    const IDLE_RESET_MS = 140
    const BOUNDARY_DWELL_MS = 220

    const lastWheelRef = { current: 0 }
    const boundaryEnterRef = { current: 0 }

    // Walk up from e.target looking for any internally scrollable ancestor
    // that is NOT at its boundary in the current scroll direction. If we
    // find one, the inner element should consume this wheel event and we
    // must not navigate (protects against momentum-carry from inner scroll
    // bleeding past its end into a tab switch).
    function innerScrollerBlocks(target, deltaY) {
      let el = target
      while (el && el !== document.body && el !== document.documentElement) {
        const cs = getComputedStyle(el)
        const oy = cs.overflowY
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
          const atTop = el.scrollTop <= 2
          if ((deltaY > 0 && !atBottom) || (deltaY < 0 && !atTop)) return el
        }
        el = el.parentElement
      }
      return null
    }

    function onWheel(e) {
      if (cooldownRef.current) return
      const now = performance.now()

      // Decay accumulator if user stopped wheeling
      if (now - lastWheelRef.current > IDLE_RESET_MS) {
        deltaRef.current = 0
        boundaryEnterRef.current = 0
      }
      lastWheelRef.current = now

      // Reset on direction change
      if (deltaRef.current !== 0 && Math.sign(e.deltaY) !== Math.sign(deltaRef.current)) {
        deltaRef.current = 0
        boundaryEnterRef.current = 0
      }

      // Any nested scroller still in motion? absorb event.
      if (innerScrollerBlocks(e.target, e.deltaY)) {
        deltaRef.current = 0
        boundaryEnterRef.current = 0
        return
      }

      // Main scroll boundary check + dwell
      const main = mainRef.current
      if (main && main.scrollHeight > main.clientHeight + 2) {
        const atBottom = main.scrollTop + main.clientHeight >= main.scrollHeight - 8
        const atTop = main.scrollTop <= 8
        const atBoundary = (e.deltaY > 0 && atBottom) || (e.deltaY < 0 && atTop)
        if (!atBoundary) {
          deltaRef.current = 0
          boundaryEnterRef.current = 0
          return
        }
        if (boundaryEnterRef.current === 0) boundaryEnterRef.current = now
        if (now - boundaryEnterRef.current < BOUNDARY_DWELL_MS) return
      }

      deltaRef.current += e.deltaY
      if (Math.abs(deltaRef.current) < THRESHOLD) return

      const dir = deltaRef.current > 0 ? 1 : -1
      deltaRef.current = 0
      boundaryEnterRef.current = 0
      cooldownRef.current = true
      setTimeout(() => { cooldownRef.current = false }, COOLDOWN)

      setPage(prev => {
        const idx = NAV_ORDER.indexOf(prev)
        const next = idx + dir
        if (next < 0 || next >= NAV_ORDER.length) return prev
        return NAV_ORDER[next]
      })
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [isMobile])

  // Touch-swipe page navigation (mobile)
  useEffect(() => {
    if (!isMobile) return
    let startX = 0, startY = 0, startT = 0, tracking = false
    const SWIPE_MIN = 60        // px horizontal
    const SWIPE_MAX_TIME = 600  // ms — quick swipes only
    const VERTICAL_TOL = 0.6    // |dy| must be < this * |dx|

    function onStart(e) {
      if (e.touches.length !== 1) { tracking = false; return }
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      startT = performance.now()
      tracking = true
    }
    function onEnd(e) {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const dt = performance.now() - startT
      if (dt > SWIPE_MAX_TIME) return
      if (Math.abs(dx) < SWIPE_MIN) return
      if (Math.abs(dy) > Math.abs(dx) * VERTICAL_TOL) return
      const dir = dx < 0 ? 1 : -1 // swipe left = next, right = prev
      setPage(prev => {
        const idx = NAV_ORDER.indexOf(prev)
        const next = idx + dir
        if (next < 0 || next >= NAV_ORDER.length) return prev
        return NAV_ORDER[next]
      })
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [isMobile])

  // Accent boost adjustment
  useEffect(() => {
    if (!lastPalette) return
    const hslRegex = /hsla?\((\d+\.?\d*),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%/
    const match = lastPalette.accent.match(hslRegex)
    if (match) {
      const [, h, s, l] = match
      const newS = Math.min(100, Math.max(0, parseFloat(s) * accentBoost))
      const adjustedAccent = `hsl(${h}, ${newS.toFixed(0)}%, ${l})`
      document.documentElement.style.setProperty('--accent', adjustedAccent)
    }
  }, [accentBoost, lastPalette])

  // Auto-save preferences (debounced) — fires after initial load completes
  useEffect(() => {
    if (!prefsLoadedRef.current) return
    clearTimeout(prefSaveTimer.current)
    prefSaveTimer.current = setTimeout(async () => {
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
      if (prefIdRef.current) {
        await supabase.from('user_preferences').update(payload).eq('id', prefIdRef.current)
      } else {
        const { data } = await supabase.from('user_preferences').insert(payload).select().single()
        if (data) { prefIdRef.current = data.id; setPrefId(data.id) }
      }
    }, 400)
    return () => clearTimeout(prefSaveTimer.current)
  }, [font, vibe, surface, density, vibeDials, surfaceDials, accentBoost, blurAmount, surfaceAlpha, panelGap])

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''} vibe-${vibe} surface-${surface}`}>
      <div
        className="wallpaper"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <div className="wallpaper-veil" />
      <div className="vibe-glow" />

      {!isMobile && <NavRail page={page} setPage={setPage} />}

      <main className="app-main" ref={mainRef}>
        {page === 'home' && (
          <HomePage events={events} tasks={tasks} setTasks={setTasks} />
        )}
        {page === 'calendar' && (
          <CalendarPage events={events} calView={calView} setCalView={setCalView} />
        )}
        {page === 'journal' && <JournalPage />}
        {page === 'settings' && (
          <SettingsPage
            font={font} setFont={setFont}
            vibe={vibe} setVibe={v => { setVibe(v); setVibeDialsState({ ...VIBE_PRESETS[v] }) }}
            surface={surface} setSurface={s => { setSurface(s); setSurfaceDialsState({ ...SURFACE_PRESETS[s] }) }}
            density={density} setDensity={setDensity}
            vibeDials={vibeDials} setVibeDial={setVibeDial} resetVibe={resetVibe}
            surfaceDials={surfaceDials} setSurfaceDial={setSurfaceDial} resetSurface={resetSurface}
            accentBoost={accentBoost} setAccentBoost={setAccentBoost}
            blurAmount={blurAmount} setBlurAmount={setBlurAmount}
            surfaceAlpha={surfaceAlpha} setSurfaceAlpha={setSurfaceAlpha}
            panelGap={panelGap} setPanelGap={setPanelGap}
            repalette={repalette}
            prefId={prefId}
            wallpaper={wallpaper} setWallpaper={setWallpaper}
          />
        )}
      </main>

      {isMobile && <MobileDock page={page} setPage={setPage} />}
    </div>
  )
}
