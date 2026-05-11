import { useEffect, useRef, useState } from 'react'
import { FONTS, VIBE_PRESETS, SURFACE_PRESETS } from '../lib/constants'
import VibeIcon from '../components/VibeIcon'
import { supabase } from '../lib/supabaseClient'

const STORAGE_KEY = 'doone-onboarding-step'
const TOTAL_STEPS = 7

function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
  catch { return 'UTC' }
}

function tzOffsetLabel(tz) {
  try {
    const fmt = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
    const parts = fmt.formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value || ''
  } catch { return '' }
}

export default function Onboarding({
  // app state values
  font, vibe, surface, density,
  // app setters (re-skin happens via these)
  setFont, setVibe, setSurface, setDensity,
  // onboarding-only field state + setters
  displayName, setDisplayName,
  timezone, setTimezone,
  dayStartHour, setDayStartHour,
  dayEndHour, setDayEndHour,
  weekStartsMonday, setWeekStartsMonday,
  notifyDigest, setNotifyDigest,
  notifyReminders, setNotifyReminders,
  notifyJournal, setNotifyJournal,
  // finish
  onFinish,
  prefIdRef,
}) {
  const [step, setStep] = useState(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
    return Number.isFinite(saved) && saved >= 0 && saved < TOTAL_STEPS ? saved : 0
  })
  const inputRef = useRef(null)

  // first-mount: auto-detect tz if user hasn't set it
  useEffect(() => {
    if (!timezone) setTimezone(detectTimezone())
  }, [])

  // persist step locally so refresh resumes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(step))
  }, [step])

  // focus primary input on step change
  useEffect(() => { inputRef.current?.focus?.() }, [step])

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  async function finish() {
    localStorage.removeItem(STORAGE_KEY)
    if (prefIdRef.current) {
      await supabase.from('user_preferences')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', prefIdRef.current)
    }
    onFinish?.()
  }

  async function skipAll() {
    // confirm only if past step 1 (don't nag on the welcome step)
    if (step > 1 && !confirm('Skip the rest of setup? You can change anything in Settings later.')) return
    await finish()
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && step < TOTAL_STEPS - 1 && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault(); next()
    }
    if (e.key === 'Escape') skipAll()
  }

  const greetingName = (displayName || '').trim() || 'friend'

  return (
    <div className="onboarding-overlay" onKeyDown={onKeyDown}>
      <div className="onboarding-shell glass" role="dialog" aria-modal="true" aria-labelledby="ob-title">
        <header className="onboarding-head">
          <div className="onboarding-dots" role="tablist" aria-label="onboarding progress">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === step}
                aria-current={i === step ? 'step' : undefined}
                className={`onboarding-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
                onClick={() => setStep(i)}
                tabIndex={-1}
              />
            ))}
          </div>
          <button className="onboarding-skip-all" onClick={skipAll}>skip onboarding</button>
        </header>

        <div className="onboarding-body" aria-live="polite">
          {step === 0 && <StepWelcome
            displayName={displayName} setDisplayName={setDisplayName}
            inputRef={inputRef}
          />}
          {step === 1 && <StepLocal
            timezone={timezone} setTimezone={setTimezone}
            dayStartHour={dayStartHour} setDayStartHour={setDayStartHour}
            dayEndHour={dayEndHour} setDayEndHour={setDayEndHour}
            weekStartsMonday={weekStartsMonday} setWeekStartsMonday={setWeekStartsMonday}
            inputRef={inputRef}
          />}
          {step === 2 && <StepVibe vibe={vibe} setVibe={setVibe} />}
          {step === 3 && <StepSurface surface={surface} setSurface={setSurface} />}
          {step === 4 && <StepDensity density={density} setDensity={setDensity} />}
          {step === 5 && <StepFont font={font} setFont={setFont} name={greetingName} />}
          {step === 6 && <StepFinish
            name={greetingName}
            notifyDigest={notifyDigest} setNotifyDigest={setNotifyDigest}
            notifyReminders={notifyReminders} setNotifyReminders={setNotifyReminders}
            notifyJournal={notifyJournal} setNotifyJournal={setNotifyJournal}
          />}
        </div>

        <footer className="onboarding-foot">
          <button
            className="btn ghost"
            onClick={prev}
            disabled={step === 0}
          >‹ back</button>
          <span className="onboarding-step-count muted small">{step + 1} of {TOTAL_STEPS}</span>
          {step < TOTAL_STEPS - 1 ? (
            <button className="btn solid" onClick={next}>continue ›</button>
          ) : (
            <button className="btn solid" onClick={finish}>let's go ›</button>
          )}
        </footer>
      </div>
    </div>
  )
}

/* ─── steps ──────────────────────────────────────────────── */

function StepWelcome({ displayName, setDisplayName, inputRef }) {
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">welcome</p>
      <h1 id="ob-title" className="onboarding-title accent">Hi. I'm DoOne.</h1>
      <p className="onboarding-sub">a quiet place for your day. what should we call you?</p>
      <input
        ref={inputRef}
        className="onboarding-input"
        type="text"
        placeholder="your name"
        maxLength={40}
        value={displayName || ''}
        onChange={e => setDisplayName(e.target.value)}
        aria-label="display name"
      />
      <p className="muted small">leave blank if you prefer — we'll just say "friend".</p>
    </section>
  )
}

function StepLocal({
  timezone, setTimezone,
  dayStartHour, setDayStartHour,
  dayEndHour, setDayEndHour,
  weekStartsMonday, setWeekStartsMonday,
  inputRef,
}) {
  const tzAbbr = tzOffsetLabel(timezone)
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">your day</p>
      <h2 className="onboarding-title">when do you do?</h2>
      <p className="onboarding-sub">we'll line up the calendar around your day.</p>

      <div className="onboarding-row">
        <label className="onboarding-field">
          <span className="field-label">time zone</span>
          <input
            ref={inputRef}
            type="text"
            className="onboarding-input slim"
            value={timezone || ''}
            onChange={e => setTimezone(e.target.value)}
            placeholder="e.g. America/New_York"
          />
          {tzAbbr && <span className="muted small">{tzAbbr}</span>}
        </label>
      </div>

      <div className="onboarding-row two">
        <label className="onboarding-field">
          <span className="field-label">day starts</span>
          <span className="big-num">{String(dayStartHour).padStart(2,'0')}:00</span>
          <input
            type="range" min="0" max="23" step="1"
            value={dayStartHour}
            onChange={e => setDayStartHour(Math.min(+e.target.value, dayEndHour - 1))}
          />
        </label>
        <label className="onboarding-field">
          <span className="field-label">day ends</span>
          <span className="big-num">{String(dayEndHour).padStart(2,'0')}:00</span>
          <input
            type="range" min="1" max="24" step="1"
            value={dayEndHour}
            onChange={e => setDayEndHour(Math.max(+e.target.value, dayStartHour + 1))}
          />
        </label>
      </div>

      <div className="onboarding-row">
        <span className="field-label">week starts</span>
        <div className="seg onboarding-seg">
          <button className={weekStartsMonday ? 'on' : ''} onClick={() => setWeekStartsMonday(true)}>monday</button>
          <button className={!weekStartsMonday ? 'on' : ''} onClick={() => setWeekStartsMonday(false)}>sunday</button>
        </div>
      </div>
    </section>
  )
}

function StepVibe({ vibe, setVibe }) {
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">vibe</p>
      <h2 className="onboarding-title">pick a mood.</h2>
      <p className="onboarding-sub">the whole app re-skins. you can change it anytime in settings.</p>
      <div className="preset-row onboarding-grid-4">
        {['calm','vivid','luminous','mono'].map(v => (
          <button
            key={v}
            className={`preset-card vibe-preview vibe-${v} ${vibe === v ? 'on' : ''}`}
            onClick={() => setVibe(v)}
            aria-pressed={vibe === v}
          >
            <VibeIcon variant={v} />
            <span className="preset-name">{v}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function StepSurface({ surface, setSurface }) {
  const lowMem = (navigator.deviceMemory ?? 8) < 4
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">surface</p>
      <h2 className="onboarding-title">how should glass feel?</h2>
      <p className="onboarding-sub">{lowMem ? 'looks like a lightweight device — try solid for best performance.' : 'pick the window material.'}</p>
      <div className="preset-row onboarding-grid-4">
        {['glass','paper','solid','sheer'].map(s => (
          <button
            key={s}
            className={`preset-card surface-preview surface-${s} ${surface === s ? 'on' : ''}`}
            onClick={() => setSurface(s)}
            aria-pressed={surface === s}
          >
            <span className="preset-sheet" />
            <span className="preset-name">{s}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function StepDensity({ density, setDensity }) {
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">density</p>
      <h2 className="onboarding-title">breathing room?</h2>
      <p className="onboarding-sub">how tightly should things pack on the page.</p>
      <div className="preset-row onboarding-grid-3">
        {[['airy','open + roomy'],['cozy','balanced'],['packed','compact']].map(([id, note]) => {
          const cols = id === 'airy' ? 3 : id === 'cozy' ? 4 : 6
          return (
            <button
              key={id}
              className={`preset-card density-preview density-${id} ${density === id ? 'on' : ''}`}
              onClick={() => setDensity(id)}
              aria-pressed={density === id}
            >
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
  )
}

function StepFont({ font, setFont, name }) {
  const sample = `Hello, ${name}. Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long' })}.`
  const current = FONTS.find(f => f.id === font)
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">typography</p>
      <h2 className="onboarding-title">pick a typeface.</h2>
      <div className="onboarding-font-preview" style={{ fontFamily: current?.stack }}>
        {sample}
      </div>
      <div className="font-pick">
        {FONTS.map(f => (
          <button
            key={f.id}
            className={`font-card ${font === f.id ? 'on' : ''}`}
            onClick={() => setFont(f.id)}
            style={{ fontFamily: f.stack }}
            aria-pressed={font === f.id}
          >
            <div>
              <div className="font-name">{f.name}</div>
              <div className="font-note">{f.note}</div>
            </div>
            <div className="font-spec">Aa 1 2 3</div>
          </button>
        ))}
      </div>
    </section>
  )
}

function StepFinish({
  name,
  notifyDigest, setNotifyDigest,
  notifyReminders, setNotifyReminders,
  notifyJournal, setNotifyJournal,
}) {
  return (
    <section className="onboarding-step">
      <p className="onboarding-eyebrow">all set</p>
      <h2 className="onboarding-title accent">You're in, {name}.</h2>
      <p className="onboarding-sub">last thing — want occasional nudges?</p>
      <div className="onboarding-toggles">
        <ToggleRow label="daily digest" hint="morning roll-up of your day"
          value={notifyDigest} onChange={setNotifyDigest} />
        <ToggleRow label="event reminders" hint="15 min before things start"
          value={notifyReminders} onChange={setNotifyReminders} />
        <ToggleRow label="journal nudge" hint="gentle reminder to write at night"
          value={notifyJournal} onChange={setNotifyJournal} />
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>
        we'll ask for browser permission only when needed.
      </p>
    </section>
  )
}

function ToggleRow({ label, hint, value, onChange }) {
  return (
    <button className="settings-row onboarding-toggle" onClick={() => onChange(!value)}>
      <div>
        <div>{label}</div>
        <div className="muted small">{hint}</div>
      </div>
      <span className={`switch ${value ? 'on' : ''}`}><span className="dot" /></span>
    </button>
  )
}
