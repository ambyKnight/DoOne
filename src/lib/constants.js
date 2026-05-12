export const VIBE_PRESETS = {
  calm:     { satMult: 0.85, lightShift: 0.04,  glowAlpha: 0.10, glowBlur: 80,  veilAlpha: 0.18 },
  vivid:    { satMult: 1.25, lightShift: -0.02, glowAlpha: 0.22, glowBlur: 60,  veilAlpha: 0.22 },
  luminous: { satMult: 1.05, lightShift: 0.10,  glowAlpha: 0.32, glowBlur: 110, veilAlpha: 0.08 },
  mono:     { satMult: 0.15, lightShift: 0,     glowAlpha: 0.04, glowBlur: 40,  veilAlpha: 0.25 },
}

export const SURFACE_PRESETS = {
  glass: { alphaMult: 1.0,  blur: 22, strokeMult: 1.0, shadowMult: 1.0, panelTint: 0.0 },
  paper: { alphaMult: 1.55, blur: 8,  strokeMult: 1.2, shadowMult: 0.6, panelTint: 0.0 },
  solid: { alphaMult: 1.85, blur: 0,  strokeMult: 1.4, shadowMult: 0.4, panelTint: 0.0 },
  sheer: { alphaMult: 0.45, blur: 36, strokeMult: 0.6, shadowMult: 1.4, panelTint: 0.08 },
}

export const DENSITY_PRESETS = {
  airy:   { pad: 26, gap: 22, scale: 1.05, radius: 22 },
  cozy:   { pad: 18, gap: 16, scale: 1.0,  radius: 18 },
  packed: { pad: 12, gap: 10, scale: 0.94, radius: 12 },
}

// gfont = Google Fonts URL query param (?family=...). Manrope ships in the
// initial HTML so its gfont is null; everything else is fetched lazily on pick.
export const FONTS = [
  // sans
  { id: 'manrope',    name: 'Manrope',         stack: '"Manrope", system-ui, sans-serif',            note: 'clean sans · default',     gfont: null },
  { id: 'outfit',     name: 'Outfit',          stack: '"Outfit", system-ui, sans-serif',             note: 'rounded geometric',        gfont: 'Outfit:wght@300;400;500;600;700' },
  { id: 'jakarta',    name: 'Plus Jakarta',    stack: '"Plus Jakarta Sans", system-ui, sans-serif',  note: 'friendly modern',          gfont: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { id: 'grotesk',    name: 'Space Grotesk',   stack: '"Space Grotesk", system-ui, sans-serif',      note: 'slightly techy',           gfont: 'Space+Grotesk:wght@300;400;500;600;700' },
  { id: 'dm',         name: 'DM Sans',         stack: '"DM Sans", system-ui, sans-serif',            note: 'soft sans',                gfont: 'DM+Sans:wght@300;400;500;600' },
  { id: 'instrument', name: 'Instrument',      stack: '"Instrument Sans", system-ui, sans-serif',    note: 'editorial sans',           gfont: 'Instrument+Sans:wght@300;400;500;600' },
  { id: 'plex',       name: 'IBM Plex',        stack: '"IBM Plex Sans", system-ui, sans-serif',      note: 'precise sans',             gfont: 'IBM+Plex+Sans:wght@300;400;500;600' },
  { id: 'quicksand',  name: 'Quicksand',       stack: '"Quicksand", system-ui, sans-serif',          note: 'soft rounded',             gfont: 'Quicksand:wght@300;400;500;600;700' },
  { id: 'bricolage',  name: 'Bricolage',       stack: '"Bricolage Grotesque", system-ui, sans-serif',note: 'expressive display',       gfont: 'Bricolage+Grotesque:wght@300;400;500;600;700' },
  { id: 'syne',       name: 'Syne',            stack: '"Syne", system-ui, sans-serif',               note: 'experimental display',     gfont: 'Syne:wght@400;500;600;700' },
  // serif
  { id: 'fraunces',   name: 'Fraunces',        stack: '"Fraunces", Georgia, serif',                  note: 'warm editorial serif',     gfont: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600' },
  { id: 'playfair',   name: 'Playfair',        stack: '"Playfair Display", Georgia, serif',          note: 'high-contrast serif',      gfont: 'Playfair+Display:wght@400;500;600;700' },
  { id: 'lora',       name: 'Lora',            stack: '"Lora", Georgia, serif',                      note: 'calligraphic serif',       gfont: 'Lora:wght@400;500;600;700' },
  { id: 'crimson',    name: 'Crimson',         stack: '"Crimson Pro", Georgia, serif',               note: 'classic book serif',       gfont: 'Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'instser',    name: 'Instrument Serif',stack: '"Instrument Serif", Georgia, serif',          note: 'tall elegant serif',       gfont: 'Instrument+Serif:ital@0;1' },
  // mono
  { id: 'jbmono',     name: 'JetBrains Mono',  stack: '"JetBrains Mono", ui-monospace, monospace',   note: 'engineering mono',         gfont: 'JetBrains+Mono:wght@400;500;600' },
  { id: 'plexmono',   name: 'IBM Plex Mono',   stack: '"IBM Plex Mono", ui-monospace, monospace',    note: 'editorial mono',           gfont: 'IBM+Plex+Mono:wght@400;500;600' },
  { id: 'spacemono',  name: 'Space Mono',      stack: '"Space Mono", ui-monospace, monospace',       note: 'retro-tech mono',          gfont: 'Space+Mono:wght@400;700' },
  { id: 'inconsolata',name: 'Inconsolata',     stack: '"Inconsolata", ui-monospace, monospace',      note: 'humanist mono',            gfont: 'Inconsolata:wght@400;500;600;700' },
]

// lazy injection — call with a font id, idempotent per id
const _loadedFonts = new Set(['manrope']) // shipped in index.html
export function ensureFontLoaded(id) {
  if (_loadedFonts.has(id)) return
  const f = FONTS.find(x => x.id === id)
  if (!f || !f.gfont) return
  _loadedFonts.add(id)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${f.gfont}&display=swap`
  document.head.appendChild(link)
}

export const ACCENT_FONT = '"Caveat", "Instrument Serif", serif'

export const TAGS = ['ev-tag1', 'ev-tag2', 'ev-tag3', 'ev-tag4']

export const DEFAULT_PREFS = {
  font: 'manrope',
  vibe: 'calm',
  surface: 'glass',
  density: 'cozy',
  accentBoost: 1.0,
  blurAmount: 22,
  surfaceAlpha: 0.55,
  panelGap: 16,
}
