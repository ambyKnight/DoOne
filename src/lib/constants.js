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
  { id: 'geist',      name: 'Geist',          stack: '"Geist", system-ui, sans-serif',              note: 'modern, neutral' },
  { id: 'outfit',     name: 'Outfit',          stack: '"Outfit", system-ui, sans-serif',             note: 'rounded geometric' },
  { id: 'jakarta',    name: 'Plus Jakarta',    stack: '"Plus Jakarta Sans", system-ui, sans-serif',  note: 'friendly modern' },
  { id: 'manrope',    name: 'Manrope',         stack: '"Manrope", system-ui, sans-serif',            note: 'clean, balanced' },
  { id: 'grotesk',    name: 'Space Grotesk',   stack: '"Space Grotesk", system-ui, sans-serif',      note: 'slightly techy' },
  { id: 'dm',         name: 'DM Sans',         stack: '"DM Sans", system-ui, sans-serif',            note: 'soft sans' },
  { id: 'instrument', name: 'Instrument',      stack: '"Instrument Sans", system-ui, sans-serif',    note: 'editorial' },
  { id: 'plex',       name: 'IBM Plex',        stack: '"IBM Plex Sans", system-ui, sans-serif',      note: 'precise' },
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
