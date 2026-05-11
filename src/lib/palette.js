function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h *= 60
  }
  return [h, s, l]
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%, ${a})`
}

export async function extractPalette(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const W = 80, H = 80
        const c = document.createElement('canvas')
        c.width = W; c.height = H
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0, W, H)
        const data = ctx.getImageData(0, 0, W, H).data

        const hueBuckets = new Array(12).fill(0)
        const satSum = new Array(12).fill(0)
        const lightSum = new Array(12).fill(0)
        let lumSum = 0, n = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const [h, s, l] = rgb2hsl(r, g, b)
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
          lumSum += lum; n++
          if (s > 0.08 && l > 0.15 && l < 0.85) {
            const bucket = Math.min(11, Math.floor(h / 30))
            hueBuckets[bucket] += 1
            satSum[bucket] += s
            lightSum[bucket] += l
          }
        }

        const avgLum = lumSum / n
        let bestBucket = 0, bestCount = -1
        for (let i = 0; i < 12; i++) {
          if (hueBuckets[i] > bestCount) { bestCount = hueBuckets[i]; bestBucket = i }
        }
        const domH = bestBucket * 30 + 15
        const domS = Math.min(0.75, Math.max(0.35, (satSum[bestBucket] / Math.max(1, hueBuckets[bestBucket])) * 1.3))
        const domL = Math.min(0.75, Math.max(0.45, lightSum[bestBucket] / Math.max(1, hueBuckets[bestBucket])))
        const dark = avgLum < 0.55

        const ink      = dark ? hsl(domH, 0.12, 0.96) : hsl(domH, 0.30, 0.16)
        const inkSoft  = dark ? hsl(domH, 0.12, 0.78) : hsl(domH, 0.20, 0.32)
        const inkMuted = dark ? hsl(domH, 0.10, 0.62) : hsl(domH, 0.15, 0.48)
        const surface1 = dark ? `hsla(${domH}, 20%, 18%, 0.55)` : `hsla(${domH}, 40%, 96%, 0.55)`
        const surface2 = dark ? `hsla(${domH}, 20%, 22%, 0.45)` : `hsla(${domH}, 40%, 98%, 0.40)`
        const surface3 = dark ? `hsla(${domH}, 25%, 28%, 0.35)` : `hsla(${domH}, 30%, 100%, 0.30)`
        const stroke       = dark ? `hsla(${domH}, 20%, 90%, 0.18)` : `hsla(${domH}, 30%, 20%, 0.14)`
        const strokeStrong = dark ? `hsla(${domH}, 20%, 90%, 0.30)` : `hsla(${domH}, 30%, 20%, 0.22)`
        const accent     = hsl(domH, domS, dark ? 0.62 : 0.50)
        const accentSoft = hsl(domH, domS * 0.7, dark ? 0.30 : 0.85)
        const sec1H = (domH + 60) % 360
        const sec2H = (domH + 180) % 360
        const sec3H = (domH - 40 + 360) % 360
        const tag1 = hsl(domH,  0.50, dark ? 0.55 : 0.78)
        const tag2 = hsl(sec1H, 0.50, dark ? 0.55 : 0.80)
        const tag3 = hsl(sec2H, 0.45, dark ? 0.55 : 0.82)
        const tag4 = hsl(sec3H, 0.50, dark ? 0.55 : 0.80)

        resolve({ dark, domH, ink, inkSoft, inkMuted, surface1, surface2, surface3, stroke, strokeStrong, accent, accentSoft, tag1, tag2, tag3, tag4 })
      } catch (e) { reject(e) }
    }
    img.onerror = reject
    img.src = src
  })
}

export function applyPalette(p) {
  const r = document.documentElement
  const map = {
    '--ink': p.ink, '--ink-soft': p.inkSoft, '--ink-muted': p.inkMuted,
    '--surface-1': p.surface1, '--surface-2': p.surface2, '--surface-3': p.surface3,
    '--stroke': p.stroke, '--stroke-strong': p.strokeStrong,
    '--accent': p.accent, '--accent-soft': p.accentSoft,
    '--tag-1': p.tag1, '--tag-2': p.tag2, '--tag-3': p.tag3, '--tag-4': p.tag4,
    '--hue': p.domH,
  }
  Object.entries(map).forEach(([k, v]) => r.style.setProperty(k, String(v)))
  r.style.colorScheme = p.dark ? 'dark' : 'light'
}
