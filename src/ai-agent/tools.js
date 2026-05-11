import { supabase } from '../lib/supabaseClient.js';

/**
 * AI Toolset for interacting with the Day Planner Database via Supabase.
 * These functions are specifically designed to be called by an LLM (like Gemini).
 */

// ---------------------------------------------------------
// 1. Core CRUD Tools
// ---------------------------------------------------------

/**
 * Create a new event.
 */
export async function create_event(args) {
  const { title, start_time, end_time, all_day = false } = args;
  
  if (!title || !start_time) {
    return { error: 'Missing required fields: title, start_time' };
  }

  const { data, error } = await supabase
    .from('events')
    .insert([{ title, start_time, end_time, all_day }])
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, event: data };
}

/**
 * Update an existing event.
 */
export async function update_event(args) {
  const { event_id, updates } = args;

  if (!event_id || !updates) {
    return { error: 'Missing required fields: event_id, updates' };
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', event_id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, event: data };
}

/**
 * Delete an event.
 */
export async function delete_event(args) {
  const { event_id } = args;

  if (!event_id) {
    return { error: 'Missing required field: event_id' };
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', event_id);

  if (error) return { error: error.message };
  return { success: true, message: `Event ${event_id} deleted successfully.` };
}

/**
 * Get events between two dates.
 */
export async function get_events(args) {
  const { start_date, end_date } = args;

  let query = supabase.from('events').select('*').order('start_time', { ascending: true });

  if (start_date) query = query.gte('start_time', start_date);
  if (end_date) query = query.lte('start_time', end_date);

  const { data, error } = await query;

  if (error) return { error: error.message };
  return { events: data };
}


// ---------------------------------------------------------
// 2. Intelligence & Ambiguity Resolution Tools
// ---------------------------------------------------------

/**
 * Semantic-ish search for events based on title.
 */
export async function search_events(args) {
  const { query, limit = 5 } = args;

  if (!query) {
    return { error: 'Missing required field: query' };
  }

  // Using case-insensitive wildcards for fuzzy matching
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .ilike('title', `%${query}%`)
    .limit(limit);

  if (error) return { error: error.message };
  return { results: data };
}

/**
 * Check if a proposed time slot overlaps with any existing events.
 */
export async function check_conflicts(args) {
  const { start_time, end_time, exclude_id } = args;

  if (!start_time || !end_time) {
    return { error: 'Missing required fields: start_time, end_time' };
  }

  // A conflict exists if an existing event starts before the new event ends
  // AND the existing event ends after the new event starts.
  let query = supabase
    .from('events')
    .select('*')
    .lt('start_time', end_time)
    .gt('end_time', start_time);

  if (exclude_id) query = query.neq('id', exclude_id);

  const { data, error } = await query;

  if (error) return { error: error.message };
  
  if (data.length > 0) {
    return { has_conflict: true, conflicting_events: data };
  }
  return { has_conflict: false };
}

/**
 * Find free time slots on a specific date for a given duration.
 */
export async function find_free_slots(args) {
  const { date, duration_minutes, work_day_start = "09:00", work_day_end = "18:00" } = args;

  if (!date || !duration_minutes) {
    return { error: 'Missing required fields: date, duration_minutes' };
  }

  // Fetch all events for that date
  const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
  const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .gte('start_time', startOfDay)
    .lte('end_time', endOfDay)
    .order('start_time', { ascending: true });

  if (error) return { error: error.message };

  // Calculate free slots
  const freeSlots = [];
  let currentStart = new Date(`${date}T${work_day_start}:00.000Z`);
  const endOfWorkDay = new Date(`${date}T${work_day_end}:00.000Z`);

  for (const event of events) {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);

    // If there is a gap between current time and the event start time
    const gapMinutes = (eventStart - currentStart) / (1000 * 60);
    if (gapMinutes >= duration_minutes) {
      freeSlots.push({
        start: currentStart.toISOString(),
        end: eventStart.toISOString()
      });
    }

    // Move the current pointer to the end of the event (or keep it if the event overlaps but started earlier)
    if (eventEnd > currentStart) {
      currentStart = eventEnd;
    }
  }

  // Check the gap after the last event until the end of the workday
  const finalGapMinutes = (endOfWorkDay - currentStart) / (1000 * 60);
  if (finalGapMinutes >= duration_minutes) {
    freeSlots.push({
      start: currentStart.toISOString(),
      end: endOfWorkDay.toISOString()
    });
  }

  return { free_slots: freeSlots };
}
