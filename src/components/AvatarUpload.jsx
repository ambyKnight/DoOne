import { useRef, useState } from 'react'
import Avatar from './Avatar'
import { supabase } from '../lib/supabaseClient'

const MAX_BYTES = 4 * 1024 * 1024 // 4MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Upload a file to `avatars/<userId>/avatar.<ext>` and return the public URL.
// Cache-busts on success so the new image displays immediately.
export async function uploadAvatar(userId, file) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Image must be PNG, JPEG, WebP, or GIF.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be under 4 MB.')
  }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/avatar.${ext}`
  const { error: uploadErr } = await supabase.storage.from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) throw uploadErr
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the same path renders the new image.
  return `${pub.publicUrl}?v=${Date.now()}`
}

// Drag/drop + click-to-pick + preview. Holds onto a File until consumed via
// the `onPicked` callback. Useful both at sign-up (no userId yet) and post-sign-in
// (immediate upload via `userId` prop).
export default function AvatarUpload({
  userId,           // if provided, upload immediately on pick
  initialUrl,
  name,
  size = 96,
  onPicked,         // (file) => void — called when a file is selected (pre-userId flow)
  onUploaded,       // (publicUrl) => void — called after upload completes
}) {
  const inputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(initialUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file) {
    if (!file) return
    setError(null)
    if (!ALLOWED.includes(file.type)) { setError('PNG, JPEG, WebP, or GIF only.'); return }
    if (file.size > MAX_BYTES) { setError('Image must be under 4 MB.'); return }
    setPreviewUrl(URL.createObjectURL(file))
    if (userId) {
      try {
        setBusy(true)
        const url = await uploadAvatar(userId, file)
        setPreviewUrl(url)
        onUploaded?.(url)
      } catch (e) {
        setError(e.message || 'Upload failed.')
      } finally {
        setBusy(false)
      }
    } else {
      onPicked?.(file)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  }

  return (
    <div className="avatar-upload">
      <div
        className={`avatar-drop ${dragging ? 'dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload avatar"
      >
        <Avatar src={previewUrl} name={name} size={size} />
        <div className="avatar-drop-overlay">{busy ? '…' : 'change'}</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(',')}
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
      />
      {error && <div className="auth-error small">{error}</div>}
    </div>
  )
}
