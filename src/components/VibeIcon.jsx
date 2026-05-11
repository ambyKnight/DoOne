/**
 * Distinct algorithmic vibe visuals — replaces the old uniform blurred-orb.
 * Each takes the current --hue/--accent and reads as its own mood at a glance.
 */
export default function VibeIcon({ variant = 'calm' }) {
  if (variant === 'calm') return <Calm />
  if (variant === 'vivid') return <Vivid />
  if (variant === 'luminous') return <Luminous />
  if (variant === 'mono') return <Mono />
  return null
}

function Calm() {
  return (
    <svg viewBox="0 0 64 64" className="vibe-icon vibe-icon-calm" aria-hidden="true">
      <defs>
        <radialGradient id="vi-calm-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="hsl(var(--hue), 70%, 80%)" stopOpacity="0.9" />
          <stop offset="60%" stopColor="hsl(var(--hue), 60%, 70%)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(var(--hue), 50%, 60%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* soft concentric rings */}
      <circle cx="32" cy="32" r="26" fill="url(#vi-calm-g)" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="hsl(var(--hue), 55%, 70%)" strokeOpacity="0.45" strokeWidth="0.8" />
      <circle cx="32" cy="32" r="13" fill="none" stroke="hsl(var(--hue), 55%, 70%)" strokeOpacity="0.55" strokeWidth="0.8" />
      <circle cx="32" cy="32" r="6"  fill="hsl(var(--hue), 65%, 78%)" />
    </svg>
  )
}

function Vivid() {
  // bold central disc + radiating spokes
  const spokes = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const x1 = 32 + Math.cos(a) * 14
    const y1 = 32 + Math.sin(a) * 14
    const x2 = 32 + Math.cos(a) * 26
    const y2 = 32 + Math.sin(a) * 26
    spokes.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--hue), 80%, 60%)" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />)
  }
  return (
    <svg viewBox="0 0 64 64" className="vibe-icon vibe-icon-vivid" aria-hidden="true">
      <defs>
        <radialGradient id="vi-viv-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="hsl(var(--hue), 100%, 70%)" />
          <stop offset="100%" stopColor="hsl(var(--hue), 80%, 50%)" />
        </radialGradient>
      </defs>
      {spokes}
      <circle cx="32" cy="32" r="11" fill="url(#vi-viv-g)" />
      <circle cx="32" cy="32" r="11" fill="none" stroke="hsl(var(--hue), 90%, 80%)" strokeOpacity="0.6" />
    </svg>
  )
}

function Luminous() {
  // brilliant core + halo + scattered light points
  return (
    <svg viewBox="0 0 64 64" className="vibe-icon vibe-icon-luminous" aria-hidden="true">
      <defs>
        <radialGradient id="vi-lum-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="hsl(calc(var(--hue) + 30), 100%, 80%)" stopOpacity="0.7" />
          <stop offset="60%" stopColor="hsl(calc(var(--hue) + 30), 100%, 70%)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(calc(var(--hue) + 30), 100%, 70%)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vi-lum-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="60%" stopColor="hsl(var(--hue), 100%, 80%)" />
          <stop offset="100%" stopColor="hsl(var(--hue), 100%, 65%)" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#vi-lum-halo)" />
      <circle cx="32" cy="32" r="10" fill="url(#vi-lum-core)" />
      {/* sparkles */}
      {[[14,16,1.2],[50,20,0.9],[12,46,1],[52,46,1.1],[32,8,0.8],[32,56,0.9],[8,32,0.7],[56,32,1]].map(([x,y,r],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="hsl(var(--hue), 100%, 88%)" fillOpacity="0.85" />
      ))}
    </svg>
  )
}

function Mono() {
  // desaturated dot grid — algorithmic noise field
  const dots = []
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const cx = 8 + x * 6
      const cy = 8 + y * 6
      // pseudo-random density based on position
      const seed = (x * 7 + y * 13) % 11
      const r = 0.6 + (seed / 11) * 1.6
      const op = 0.25 + (seed / 11) * 0.55
      dots.push(<circle key={`${x}-${y}`} cx={cx} cy={cy} r={r} fill="hsl(220, 8%, 30%)" fillOpacity={op} />)
    }
  }
  return (
    <svg viewBox="0 0 64 64" className="vibe-icon vibe-icon-mono" aria-hidden="true">
      <rect x="0" y="0" width="64" height="64" rx="10" fill="hsl(220, 6%, 92%)" />
      {dots}
    </svg>
  )
}
