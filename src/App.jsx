import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { supabase } from './lib/supabaseClient'
import { useAuth } from './lib/authContext'
import { VIBE_PRESETS, SURFACE_PRESETS, DENSITY_PRESETS, FONTS, DEFAULT_PREFS, ensureFontLoaded } from './lib/constants'
import { extractPalette, applyPalette } from './lib/palette'
import NavRail from './components/NavRail'
import MobileDock from './components/MobileDock'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage' // home is the landing; keep eager
import AuthGate from './pages/AuthGate'
import defaultWallpaper from './assets/wallpaper.webp'

// Off-home pages are code-split. Calendar pulls in FullCalendar (heavy);
// Settings pulls in lots of UI; Journal + Onboarding are also infrequent.
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const JournalPage  = lazy(() => import('./pages/JournalPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const Onboarding   = lazy(() => import('./pages/Onboarding'))

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
  const { user, loading: authLoading } = useAuth()
  const [page, setPage] = useState('home')
  const [calView, setCalViewState] = useState('dayGridMonth')
  function setCalView(v) { setCalViewState(v) }
  const [isMobile, setIsMobile] = useState(window.innerWidth < 880)

  const mainRef = useRef(null)
  const deltaRef = useRef(0)
  const cooldownRef = useRef(false)
  const prefsLoadedRef = useRef(false)
  const prefSaveTimer = useRef(null)
  const prefIdRef = useRef(null)
  // Fingerprint of last payload sent OR last payload applied from DB. Used to
  // (a) skip redundant auto-saves that would just echo back, and (b) ignore
  // realtime UPDATEs that are echoes of our own writes.
  const lastPrefFingerprintRef = useRef(null)
  // Columns we've discovered are missing in this DB (schema not yet migrated).
  // We exclude them from BOTH the save payload and the fingerprint computation,
  // so local + remote fingerprints stay equal and we don't loop on echoes.
  const missingPrefColsRef = useRef(new Set())

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
  // onboarding fields (kept for future use; auto-completed at signup for now)
  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('')
  const [dayStartHour, setDayStartHour] = useState(7)
  const [dayEndHour, setDayEndHour] = useState(22)
  const [weekStartsMonday, setWeekStartsMonday] = useState(true)
  const [notifyDigest, setNotifyDigest] = useState(false)
  const [notifyReminders, setNotifyReminders] = useState(false)
  const [notifyJournal, setNotifyJournal] = useState(false)
  const [onboardedAt, setOnboardedAt] = useState(undefined)
  const [headerShrink, setHeaderShrink] = useState(false)

  // Fingerprint of the persistable subset of prefs. JSON-stable so we can
  // compare with === / strict equality on the resulting string.
  // Excludes columns we know don't exist in the DB yet — otherwise local
  // (which has the value) and remote (where the column is absent) would
  // produce different fingerprints, triggering an infinite save/echo loop.
  function prefFingerprint(p) {
    const all = {
      font: p.font, vibe: p.vibe, surface: p.surface, density: p.density,
      vibe_dials: p.vibe_dials, surface_dials: p.surface_dials,
      accent_boost: p.accent_boost, blur_amount: p.blur_amount,
      surface_alpha: p.surface_alpha, panel_gap: p.panel_gap,
      cal_view: p.cal_view,
      display_name: p.display_name, timezone: p.timezone,
      day_start_hour: p.day_start_hour, day_end_hour: p.day_end_hour,
      week_starts_monday: p.week_starts_monday,
      notify_digest: p.notify_digest, notify_reminders: p.notify_reminders,
      notify_journal: p.notify_journal,
      wallpaper_url: p.wallpaper_url,
    }
    for (const k of missingPrefColsRef.current) delete all[k]
    return JSON.stringify(all)
  }

  // Apply a user_preferences row from DB to local state. Used by both the
  // initial load and the realtime UPDATE handler so client B reflects client
  // A's changes live. Skips fields that are null/undefined so the row's
  // partial updates don't clobber defaults.
  function applyPrefRow(row) {
    if (!row) return
    if (row.font) setFont(row.font)
    if (row.vibe) setVibe(row.vibe)
    if (row.surface) setSurface(row.surface)
    if (row.density) setDensity(row.density)
    if (row.vibe_dials) setVibeDialsState(row.vibe_dials)
    else if (row.vibe) setVibeDialsState({ ...VIBE_PRESETS[row.vibe] })
    if (row.surface_dials) setSurfaceDialsState(row.surface_dials)
    else if (row.surface) setSurfaceDialsState({ ...SURFACE_PRESETS[row.surface] })
    if (row.accent_boost != null) setAccentBoost(row.accent_boost)
    if (row.blur_amount != null) setBlurAmount(row.blur_amount)
    if (row.surface_alpha != null) setSurfaceAlpha(row.surface_alpha)
    if (row.panel_gap != null) setPanelGap(row.panel_gap)
    if (row.cal_view) setCalViewState(row.cal_view)
    if (row.display_name != null) setDisplayName(row.display_name)
    if (row.timezone != null) setTimezone(row.timezone)
    if (row.day_start_hour != null) setDayStartHour(row.day_start_hour)
    if (row.day_end_hour != null) setDayEndHour(row.day_end_hour)
    if (row.week_starts_monday != null) setWeekStartsMonday(row.week_starts_monday)
    if (row.notify_digest != null) setNotifyDigest(row.notify_digest)
    if (row.notify_reminders != null) setNotifyReminders(row.notify_reminders)
    if (row.notify_journal != null) setNotifyJournal(row.notify_journal)
    // wallpaper_url: only react if the column is present on the row. If the
    // key is absent (schema not yet migrated), don't clobber local state.
    if ('wallpaper_url' in row) {
      setWallpaper(row.wallpaper_url || defaultWallpaper)
    }
    // Record fingerprint so the auto-save effect knows this state matches DB
    // and skips a redundant write (which would echo back via realtime).
    lastPrefFingerprintRef.current = prefFingerprint(row)
  }

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
  useEffect(() => {
    document.documentElement.style.setProperty('--wallpaper-url', `url(${wallpaper})`)
    extractPalette(wallpaper).then(p => {
      setLastPalette(p)
      applyPalette(p)
    }).catch(console.error)
  }, [wallpaper])

  // Window resize — independent of session.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 880)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Data load + realtime, scoped to the signed-in user.
  useEffect(() => {
    if (!user) {
      setEvents([])
      setTasks([])
      prefsLoadedRef.current = false
      prefIdRef.current = null
      setPrefId(null)
      setOnboardedAt(undefined)
      return
    }

    const userFilter = `user_id=eq.${user.id}`

    supabase.from('events').select('*').eq('user_id', user.id).order('start_time')
      .then(({ data }) => { if (data) setEvents(data.map(toFCEvent)) })

    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at')
      .then(({ data }) => { if (data) setTasks(data) })

    supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          prefIdRef.current = data.id
          setPrefId(data.id)
          applyPrefRow(data)
          setOnboardedAt(data.onboarded_at ?? new Date().toISOString())
        } else {
          // New user — auto-complete onboarding (skipped per current scope)
          const nowIso = new Date().toISOString()
          const { data: created } = await supabase.from('user_preferences')
            .insert({ user_id: user.id, onboarded_at: nowIso })
            .select().single()
          if (created) {
            prefIdRef.current = created.id
            setPrefId(created.id)
            applyPrefRow(created)
          }
          setOnboardedAt(nowIso)
        }
        prefsLoadedRef.current = true
      })

    const ch = supabase.channel(`app-realtime-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: userFilter },
        ({ new: r }) => setEvents(p => [...p, toFCEvent(r)]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: userFilter },
        ({ new: r }) => setEvents(p => p.map(e => e.id === r.id ? toFCEvent(r) : e)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events', filter: userFilter },
        ({ old: r }) => setEvents(p => p.filter(e => e.id !== r.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: userFilter },
        ({ new: r }) => setTasks(p => [...p, r]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: userFilter },
        ({ new: r }) => setTasks(p => p.map(t => t.id === r.id ? r : t)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks', filter: userFilter },
        ({ old: r }) => setTasks(p => p.filter(t => t.id !== r.id)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_preferences', filter: userFilter },
        ({ new: row }) => {
          // Ignore our own echoes — fingerprint will match.
          if (prefFingerprint(row) === lastPrefFingerprintRef.current) return
          applyPrefRow(row)
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user])

  // Font → --font. Lazily fetch the chosen font's woff2 from Google Fonts.
  useEffect(() => {
    const f = FONTS.find(x => x.id === font)
    if (!f) return
    ensureFontLoaded(font)
    document.documentElement.style.setProperty('--font', f.stack)
  }, [font])

  // Mobile sticky-header collapse: shrink after ~60px of scroll inside main.
  useEffect(() => {
    if (!isMobile) { setHeaderShrink(false); return }
    const main = mainRef.current
    if (!main) return
    const onScroll = () => setHeaderShrink(main.scrollTop > 60)
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [isMobile, page])

  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--vibe-sat-mult', vibeDials.satMult)
    r.style.setProperty('--vibe-glow-alpha', vibeDials.glowAlpha)
    r.style.setProperty('--vibe-glow-blur', `${vibeDials.glowBlur}px`)
    r.style.setProperty('--vibe-veil-alpha', vibeDials.veilAlpha)
  }, [vibeDials])

  // Surface dials → CSS vars. NOTE: --surface-alpha-mult and --blur are
  // deliberately NOT written here; blurAmount + surfaceAlpha overrides own them.
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--stroke-mult', surfaceDials.strokeMult)
    r.style.setProperty('--shadow-mult', surfaceDials.shadowMult)
    r.style.setProperty('--panel-tint', surfaceDials.panelTint ?? 0)
    r.style.setProperty('--surface-tint', surfaceDials.tint ?? 100)
    r.style.setProperty('--surface-base', surfaceDials.baseColor ?? '#ffffff')
  }, [surfaceDials])

  useEffect(() => {
    const d = DENSITY_PRESETS[density]
    const r = document.documentElement
    r.style.setProperty('--panel-pad', `${d.pad}px`)
    r.style.setProperty('--panel-gap', `${d.gap}px`)
    r.style.setProperty('--type-scale', d.scale)
    r.style.setProperty('--rad', `${d.radius}px`)
  }, [density])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-boost', accentBoost)
  }, [accentBoost])

  useEffect(() => {
    document.documentElement.style.setProperty('--blur', `${blurAmount}px`)
  }, [blurAmount])

  useEffect(() => {
    document.documentElement.style.setProperty('--surface-alpha-mult', surfaceAlpha)
  }, [surfaceAlpha])

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
      if (now - lastWheelRef.current > IDLE_RESET_MS) {
        deltaRef.current = 0
        boundaryEnterRef.current = 0
      }
      lastWheelRef.current = now
      if (deltaRef.current !== 0 && Math.sign(e.deltaY) !== Math.sign(deltaRef.current)) {
        deltaRef.current = 0
        boundaryEnterRef.current = 0
      }
      if (innerScrollerBlocks(e.target, e.deltaY)) {
        deltaRef.current = 0
        boundaryEnterRef.current = 0
        return
      }
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
    const SWIPE_MIN = 60
    const SWIPE_MAX_TIME = 600
    const VERTICAL_TOL = 0.6

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
      const dir = dx < 0 ? 1 : -1
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

  useEffect(() => {
    if (!lastPalette) return
    const hslRegex = /hsla?\((\d+\.?\d*),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%/
    const match = lastPalette.accent.match(hslRegex)
    if (match) {
      const [, h, s, l] = match
      const newS = Math.min(100, Math.max(0, parseFloat(s) * accentBoost))
      const adjustedAccent = `hsl(${h}, ${newS.toFixed(0)}%, ${l}%)`
      document.documentElement.style.setProperty('--accent', adjustedAccent)
    }
  }, [accentBoost, lastPalette])

  // Auto-save preferences (debounced) — fires after initial load completes
  useEffect(() => {
    if (!prefsLoadedRef.current || !user) return
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
        cal_view: calView,
        display_name: displayName || null,
        timezone: timezone || null,
        day_start_hour: dayStartHour,
        day_end_hour: dayEndHour,
        week_starts_monday: weekStartsMonday,
        notify_digest: notifyDigest,
        notify_reminders: notifyReminders,
        notify_journal: notifyJournal,
        wallpaper_url: wallpaper === defaultWallpaper ? null : wallpaper,
      }
      // Strip columns we already know are missing (avoids redundant retries).
      for (const k of missingPrefColsRef.current) delete payload[k]
      const fp = prefFingerprint(payload)
      // Skip if nothing meaningful changed (avoids redundant writes echoing
      // back via realtime; saves DB round-trip on idle dial-twiddling that
      // settled to the original value).
      if (fp === lastPrefFingerprintRef.current) return
      lastPrefFingerprintRef.current = fp
      const dbPayload = { ...payload, updated_at: new Date().toISOString() }
      // Resilient save — if a column doesn't exist yet (i.e. user hasn't run
      // the latest migration), strip the missing field and retry rather than
      // letting every save fail silently.
      async function tryWrite(body) {
        if (prefIdRef.current) {
          return supabase.from('user_preferences').update(body).eq('id', prefIdRef.current).select()
        }
        return supabase.from('user_preferences').insert({ ...body, user_id: user.id }).select().single()
      }
      let body = dbPayload
      for (let i = 0; i < 4; i++) {
        const r = await tryWrite(body)
        if (!r.error) {
          const created = r.data && !Array.isArray(r.data) ? r.data : null
          if (created && !prefIdRef.current) { prefIdRef.current = created.id; setPrefId(created.id) }
          break
        }
        const msg = r.error.message || ''
        // Match both raw Postgres ("column public.user_preferences.foo does not exist")
        // and PostgREST schema-cache ("Could not find the 'foo' column of ...").
        const m = msg.match(/(?:could not find the ['"]([\w]+)['"]\s+column|column ['"]?[\w.]*?(\w+)['"]? .*does not exist)/i)
        const colName = m && (m[1] || m[2])
        if (colName && body[colName] !== undefined) {
          missingPrefColsRef.current.add(colName)
          // Recompute the fingerprint without this column so future saves
          // and incoming echoes compare apples-to-apples.
          lastPrefFingerprintRef.current = prefFingerprint(payload)
          const next = { ...body }
          delete next[colName]
          body = next
          continue
        }
        console.error('[prefs save]', r.error)
        break
      }
    }, 400)
    return () => clearTimeout(prefSaveTimer.current)
  }, [user, font, vibe, surface, density, vibeDials, surfaceDials, accentBoost, blurAmount, surfaceAlpha, panelGap,
      calView, displayName, timezone, dayStartHour, dayEndHour, weekStartsMonday, notifyDigest, notifyReminders, notifyJournal,
      wallpaper])

  if (authLoading) {
    return (
      <div className="app boot-splash">
        <div className="wallpaper" style={{ backgroundImage: `url(${wallpaper})` }} />
        <div className="wallpaper-veil" />
      </div>
    )
  }

  if (!user) {
    return <AuthGate wallpaper={wallpaper} />
  }

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}${headerShrink ? ' is-header-shrunk' : ''} vibe-${vibe} surface-${surface}`}>
      <div
        className="wallpaper"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <div className="wallpaper-veil" />
      <div className="vibe-glow" />

      {!isMobile && <NavRail page={page} setPage={setPage} />}

      <main className="app-main" ref={mainRef}>
        <ErrorBoundary>
        <Suspense fallback={<div className="page" />}>
        {page === 'home' && (
          <HomePage events={events} tasks={tasks} setTasks={setTasks} isMobile={isMobile} setPage={setPage} />
        )}
        {page === 'calendar' && (
          <CalendarPage events={events} calView={calView} setCalView={setCalView} isMobile={isMobile} />
        )}
        {page === 'journal' && <JournalPage isMobile={isMobile} />}
        {page === 'settings' && (
          <SettingsPage
            font={font} setFont={setFont}
            vibe={vibe} setVibe={v => { setVibe(v); setVibeDialsState({ ...VIBE_PRESETS[v] }) }}
            surface={surface} setSurface={s => {
              const preset = SURFACE_PRESETS[s]
              setSurface(s)
              setSurfaceDialsState(prev => ({ ...preset, baseColor: prev.baseColor, tint: prev.tint }))
              setBlurAmount(preset.blur)
              setSurfaceAlpha(Math.min(1, preset.alphaMult * 0.55))
            }}
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
            lastPalette={lastPalette}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>

      {isMobile && <MobileDock page={page} setPage={setPage} />}
    </div>
  )
}
