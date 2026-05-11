function initialsOf(name) {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // For single-word usernames, take first two chars. For multi-word, first letter of first two words.
  const parts = trimmed.split(/[\s_.-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

// Deterministic hue from string so the fallback color is stable per username.
function hueOf(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

export default function Avatar({ src, name, size = 40, onClick, className = '', title }) {
  const dim = { width: size, height: size }
  const cls = `avatar ${className}`.trim()
  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'div'
  const handlerProps = interactive ? { onClick, type: 'button' } : {}

  if (src) {
    return (
      <Tag
        className={cls}
        style={dim}
        title={title || name}
        aria-label={title || name || 'avatar'}
        {...handlerProps}
      >
        <img src={src} alt="" />
      </Tag>
    )
  }
  const hue = name ? hueOf(name) : 220
  const bg = `linear-gradient(135deg, hsl(${hue}, 60%, 62%), hsl(${(hue + 40) % 360}, 65%, 50%))`
  return (
    <Tag
      className={`${cls} fallback`}
      style={{ ...dim, background: bg, fontSize: size * 0.38 }}
      title={title || name}
      aria-label={title || name || 'avatar'}
      {...handlerProps}
    >
      {initialsOf(name)}
    </Tag>
  )
}
