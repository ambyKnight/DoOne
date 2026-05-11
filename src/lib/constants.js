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

export const FONTS = [
  // sans
  { id: 'manrope',    name: 'Manrope',         stack: '"Manrope", system-ui, sans-serif',            note: 'clean sans · default' },
  { id: 'outfit',     name: 'Outfit',          stack: '"Outfit", system-ui, sans-serif',             note: 'rounded geometric' },
  { id: 'jakarta',    name: 'Plus Jakarta',    stack: '"Plus Jakarta Sans", system-ui, sans-serif',  note: 'friendly modern' },
  { id: 'grotesk',    name: 'Space Grotesk',   stack: '"Space Grotesk", system-ui, sans-serif',      note: 'slightly techy' },
  { id: 'dm',         name: 'DM Sans',         stack: '"DM Sans", system-ui, sans-serif',            note: 'soft sans' },
  { id: 'instrument', name: 'Instrument',      stack: '"Instrument Sans", system-ui, sans-serif',    note: 'editorial sans' },
  { id: 'plex',       name: 'IBM Plex',        stack: '"IBM Plex Sans", system-ui, sans-serif',      note: 'precise sans' },
  { id: 'quicksand',  name: 'Quicksand',       stack: '"Quicksand", system-ui, sans-serif',          note: 'soft rounded' },
  { id: 'bricolage',  name: 'Bricolage',       stack: '"Bricolage Grotesque", system-ui, sans-serif',note: 'expressive display' },
  { id: 'syne',       name: 'Syne',            stack: '"Syne", system-ui, sans-serif',               note: 'experimental display' },
  // serif
  { id: 'fraunces',   name: 'Fraunces',        stack: '"Fraunces", Georgia, serif',                  note: 'warm editorial serif' },
  { id: 'playfair',   name: 'Playfair',        stack: '"Playfair Display", Georgia, serif',          note: 'high-contrast serif' },
  { id: 'lora',       name: 'Lora',            stack: '"Lora", Georgia, serif',                      note: 'calligraphic serif' },
  { id: 'crimson',    name: 'Crimson',         stack: '"Crimson Pro", Georgia, serif',               note: 'classic book serif' },
  { id: 'instser',    name: 'Instrument Serif',stack: '"Instrument Serif", Georgia, serif',          note: 'tall elegant serif' },
  // mono
  { id: 'jbmono',     name: 'JetBrains Mono',  stack: '"JetBrains Mono", ui-monospace, monospace',   note: 'engineering mono' },
  { id: 'plexmono',   name: 'IBM Plex Mono',   stack: '"IBM Plex Mono", ui-monospace, monospace',    note: 'editorial mono' },
  { id: 'spacemono',  name: 'Space Mono',      stack: '"Space Mono", ui-monospace, monospace',       note: 'retro-tech mono' },
  { id: 'inconsolata',name: 'Inconsolata',     stack: '"Inconsolata", ui-monospace, monospace',      note: 'humanist mono' },
]

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
