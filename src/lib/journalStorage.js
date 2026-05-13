import { supabase } from './supabaseClient'

// Journals live in public.journal_entries — one row per (user_id, entry_date).
// Migrated from Storage to DB for cross-device realtime streaming.
//
// Row shape: { id, user_id, entry_date, did, plan, mood, updated_at }
// Public API preserves the prior pointer-style contract so JournalPage.jsx
// can keep using `date` / `updated_at` fields unchanged.

const EMPTY = { did: '', plan: '', mood: '' }

function rowToPointer(row) {
  return {
    user_id: row.user_id,
    date: row.entry_date,
    updated_at: row.updated_at,
  }
}

export async function readJournal(userId, date) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('did, plan, mood')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .maybeSingle()
  if (error) throw error
  if (!data) return { ...EMPTY }
  return { ...EMPTY, ...data }
}

// Write upserts the row, returns updated_at for the echo-guard.
export async function writeJournal(userId, date, content) {
  const updated_at = new Date().toISOString()
  const payload = {
    user_id: userId,
    entry_date: date,
    did: content.did ?? '',
    plan: content.plan ?? '',
    mood: content.mood ?? '',
    updated_at,
  }
  const { error } = await supabase
    .from('journal_entries')
    .upsert(payload, { onConflict: 'user_id,entry_date' })
  if (error) throw error
  return updated_at
}

// List metadata for all entries (most-recent-date-first). Shape kept
// compatible with the old pointer rows.
export async function listJournalPointers(userId) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('user_id, entry_date, updated_at')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
  if (error) throw error
  return (data || []).map(r => ({ user_id: r.user_id, date: r.entry_date, updated_at: r.updated_at }))
}

// One-shot fetch: returns pointers AND content for every entry in a single
// round-trip. Used on mount so the journal page renders instantly without
// the list → create → read cascade.
export async function listJournalEntriesFull(userId) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('user_id, entry_date, did, plan, mood, updated_at')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
  if (error) throw error
  const pointers = []
  const contents = {}
  for (const r of (data || [])) {
    pointers.push({ user_id: r.user_id, date: r.entry_date, updated_at: r.updated_at })
    contents[r.entry_date] = { did: r.did ?? '', plan: r.plan ?? '', mood: r.mood ?? '' }
  }
  return { pointers, contents }
}

// Create an empty row for `date`. Returns pointer-shaped row.
export async function createJournal(userId, date) {
  const updated_at = await writeJournal(userId, date, EMPTY)
  return { user_id: userId, date, updated_at }
}

// Helper for realtime callers — convert a journal_entries row to the
// pointer/content split JournalPage expects.
export function splitRow(row) {
  return {
    pointer: rowToPointer(row),
    content: { did: row.did ?? '', plan: row.plan ?? '', mood: row.mood ?? '' },
  }
}
