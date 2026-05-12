import { supabase } from './supabaseClient'

const BUCKET = 'wallpapers'
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

// Random short id for filename so two uploads with the same name don't collide.
function rid() {
  return Math.random().toString(36).slice(2, 10)
}

export async function listWallpapers(userId) {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw error
  return (data || [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => {
      const path = `${userId}/${f.name}`
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { name: f.name, path, url: pub.publicUrl, created_at: f.created_at }
    })
}

export async function uploadWallpaper(userId, file) {
  if (!ALLOWED.includes(file.type)) throw new Error('PNG, JPEG, WebP, or GIF only.')
  if (file.size > MAX_BYTES) throw new Error('Image must be under 8 MB.')
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/${Date.now()}-${rid()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (up.error) throw up.error
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: pub.publicUrl, name: path.split('/').pop() }
}

export async function deleteWallpaper(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
