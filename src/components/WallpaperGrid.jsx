import { useEffect, useRef, useState } from 'react'
import { listWallpapers, uploadWallpaper, deleteWallpaper } from '../lib/wallpapers'
import { useAuth } from '../lib/authContext'
import LowPolyWallpaper from './LowPolyWallpaper'
const defaultWallpaper = '/wallpaper.webp'

const BUILTIN = [{ name: 'default', path: null, url: defaultWallpaper, isBuiltin: true }]

export default function WallpaperGrid({ activeUrl, onSelect }) {
  const { user } = useAuth()
  const [uploads, setUploads] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  async function refresh() {
    if (!user) return
    try { setUploads(await listWallpapers(user.id)) } catch (e) { setError(e.message) }
  }

  useEffect(() => { refresh() }, [user])

  async function handleFile(file) {
    if (!file || !user) return
    setError(null); setBusy(true)
    try {
      const wp = await uploadWallpaper(user.id, file)
      setUploads(prev => [wp, ...prev])
      onSelect?.(wp.url)
    } catch (e) {
      setError(e.message || 'Upload failed.')
    } finally { setBusy(false) }
  }

  async function handleDelete(wp) {
    if (!user) return
    try {
      await deleteWallpaper(wp.path)
      setUploads(prev => prev.filter(w => w.path !== wp.path))
      // If the deleted wallpaper was active, fall back to default.
      if (activeUrl === wp.url) onSelect?.(null)
    } catch (e) { setError(e.message || 'Delete failed.') }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  }

  const all = [...BUILTIN, ...uploads]

  return (
    <div className="wallpaper-grid-wrap">
      <div
        className={`wp-upload-zone ${dragging ? 'dragover' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <span className="wp-upload-icon" aria-hidden="true">＋</span>
        <span>{busy ? 'uploading…' : 'drop or click to upload'}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <div className="auth-error small">{error}</div>}
      <div className="wallpaper-grid">
        {all.map(wp => {
          const isActive = wp.isBuiltin
            ? !activeUrl || activeUrl === defaultWallpaper
            : activeUrl === wp.url
          return (
            <div
              key={wp.url}
              className={`wp-tile ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelect?.(wp.isBuiltin ? null : wp.url)}
              role="button"
              tabIndex={0}
              aria-label={wp.name}
              aria-pressed={isActive}
            >
              <LowPolyWallpaper src={wp.url} cols={48} rows={36} />
              {wp.isBuiltin && <span className="wp-tile-label">default</span>}
              {!wp.isBuiltin && (
                <button
                  className="wp-tile-del"
                  onClick={e => { e.stopPropagation(); handleDelete(wp) }}
                  aria-label="delete wallpaper"
                  title="delete"
                >×</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
