/**
 * Tiny seeded generative SVG flourish — placed in card corners as quiet
 * ambient ornaments. Same `seed` → same output (deterministic).
 *
 * Variants:
 *   'arc'    concentric quarter-arcs
 *   'mesh'   loose triangle mesh
 *   'wave'   stacked sine waves
 *   'stars'  tiny seeded star field
 */

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function AlgorithmicOrnament({ variant = 'arc', seed = 1, size = 120, className = '', position = 'tr' }) {
  const r = mulberry32(seed)
  const els = []

  if (variant === 'arc') {
    const cx = size, cy = 0
    for (let i = 0; i < 8; i++) {
      const rad = 16 + i * 10 + r() * 6
      els.push(
        <path key={i}
          d={`M ${cx - rad} ${cy} A ${rad} ${rad} 0 0 0 ${cx} ${cy + rad}`}
          strokeOpacity={0.35 + i * 0.06}
        />
      )
    }
  } else if (variant === 'mesh') {
    const pts = []
    for (let i = 0; i < 7; i++) pts.push([r() * size, r() * size])
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (r() > 0.55) continue
        els.push(<line key={`${i}-${j}`} x1={pts[i][0]} y1={pts[i][1]} x2={pts[j][0]} y2={pts[j][1]} strokeOpacity={0.5} />)
      }
    }
    pts.forEach(([x, y], k) => els.push(<circle key={`p${k}`} cx={x} cy={y} r={1.4} fill="currentColor" stroke="none" />))
  } else if (variant === 'wave') {
    for (let i = 0; i < 5; i++) {
      const amp = 4 + i * 2
      const yBase = 18 + i * 18
      let d = `M 0 ${yBase}`
      for (let x = 0; x <= size; x += 4) {
        const y = yBase + Math.sin((x / size) * Math.PI * 2 + r() * 6) * amp
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      }
      els.push(<path key={i} d={d} strokeOpacity={0.5 - i * 0.07} />)
    }
  } else if (variant === 'stars') {
    for (let i = 0; i < 22; i++) {
      const x = r() * size, y = r() * size
      const rad = 0.6 + r() * 1.4
      els.push(<circle key={i} cx={x} cy={y} r={rad} fill="currentColor" stroke="none" fillOpacity={0.3 + r() * 0.5} />)
    }
  }

  return (
    <svg
      className={`ornament ${position} ${className}`}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      {els}
    </svg>
  )
}
