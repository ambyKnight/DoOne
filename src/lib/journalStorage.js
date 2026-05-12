import { supabase } from './supabaseClient'

// Journals live in the private `journals` bucket at `<user_id>/<date>.json`.
// A row in public.journal_pointers tracks each one purely for realtime sync —
// the pointer table has no text content, just metadata that triggers a
// Postgres realtime UPDATE other clients can listen on.

const BUCKET = 'journals'
const pathFor = (userId, date) => `${userId}/${date}.json`

const EMPTY = { did: '', plan: '', mood: '' }

export async function readJournal(userId, date) {
  const { data, error } = await supabase.storage.from(BUCKET).download(pathFor(userId, date))
  if (error) {
    if (error.message?.toLowerCase().includes('not found') || error.status === 404) return { ...EMPTY }
    throw error
  }
  const text = await data.text()
  try {
    const parsed = JSON.parse(text)
    return { ...EMPTY, ...parsed }
  } catch {
    return { ...EMPTY }
  }
}

// Write returns the updated_at timestamp so callers can record it for the
// echo-guard (skip realtime UPDATE events that match our own write).
export async function writeJournal(userId, date, content) {
  const path = pathFor(userId, date)
  const body = new Blob([JSON.stringify({ ...EMPTY, ...content })], { type: 'application/json' })
  const up = await supabase.storage.from(BUCKET).upload(path, body, { upsert: true, contentType: 'application/json' })
  if (up.error) throw up.error
  const updated_at = new Date().toISOString()
  const ptr = await supabase.from('journal_pointers')
    .upsert({ user_id: userId, date, storage_path: path, updated_at }, { onConflict: 'user_id,date' })
  if (ptr.error) throw ptr.error
  return updated_at
}

// Pointer table is source of truth for "which entries exist". Returns rows
// ordered most-recent-date-first.
export async function listJournalPointers(userId) {
  const { data, error } = await supabase.from('journal_pointers')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

// Create an empty entry for `date` (only if one doesn't exist yet).
// Returns the new pointer row.
export async function createJournal(userId, date) {
  const updated_at = await writeJournal(userId, date, EMPTY)
  return { user_id: userId, date, storage_path: pathFor(userId, date), updated_at }
}
