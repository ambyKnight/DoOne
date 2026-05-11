import { useEffect, useRef } from 'react'

/**
 * Renders a tiny pixelated downscaled copy of the given image URL.
 * Browser samples it at low resolution; CSS image-rendering: pixelated then
 * scales the canvas up cleanly, producing a low-poly / pixel-art feel without
 * the aliasing you get from arbitrarily-scaling the full-resolution image.
 *
 * Doubles up by drawing the downscaled buffer to a slightly larger canvas
 * with averaged pixel sampling — the result reads as a chunky mosaic that
 * still shows the wallpaper's composition.
 */
export default function LowPolyWallpaper({ src, cols = 32, rows = 18 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!src) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = cols
    canvas.height = rows

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      // draw scaled-down: browser averages the source pixels for us
      ctx.drawImage(img, 0, 0, cols, rows)
    }
    img.src = src
  }, [src, cols, rows])

  return <canvas ref={canvasRef} aria-hidden="true" />
}
