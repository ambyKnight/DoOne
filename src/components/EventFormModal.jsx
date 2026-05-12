import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { check_conflicts } from '../ai-agent/tools'
import { useAuth } from '../lib/authContext'

const TAGS = ['ev-tag1', 'ev-tag2', 'ev-tag3', 'ev-tag4']

export default function EventFormModal({ mode, defaultValues, onClose }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(defaultValues.title ?? '')
  const [allDay, setAllDay] = useState(defaultValues.allDay ?? false)
  const [startTime, setStartTime] = useState(defaultValues.startTime ?? '')
  const [endTime, setEndTime] = useState(defaultValues.endTime ?? '')
  const [tag, setTag] = useState(defaultValues.tag ?? 'ev-tag1')
  const [conflicts, setConflicts] = useState([])
  const [saving, setSaving] = useState(false)
  const conflictTimer = useRef(null)

  useEffect(() => {
    clearTimeout(conflictTimer.current)
    if (!startTime || !endTime || allDay) { setConflicts([]); return }
    conflictTimer.current = setTimeout(async () => {
      const result = await check_conflicts({
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        exclude_id: defaultValues.id,
      })
      setConflicts(result.has_conflict ? result.conflicting_events : [])
    }, 400)
    return () => clearTimeout(conflictTimer.current)
  }, [startTime, endTime, allDay])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      all_day: allDay,
      start_time: allDay ? startTime : new Date(startTime).toISOString(),
      end_time: endTime ? (allDay ? endTime : new Date(endTime).toISOString()) : null,
      tag,
    }
    if (mode === 'create') {
      await supabase.from('events').insert({ ...payload, user_id: user?.id })
    } else {
      await supabase.from('events').update(payload).eq('id', defaultValues.id)
    }
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    setSaving(true)
    await supabase.from('events').delete().eq('id', defaultValues.id)
    setSaving(false)
    onClose()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && !e.shiftKey && title.trim() && !saving) handleSave()
  }

  return (
    <div
      className="modal-back"
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="modal glass" role="dialog" aria-modal="true">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="modal-head">
          <h3>{mode === 'create' ? 'New event' : 'Edit event'}</h3>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <label>
            Title
            <input
              type="text"
              placeholder="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </label>

          <div className="modal-allday-row">
            <input
              type="checkbox"
              id="allday-check"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
            />
            <label htmlFor="allday-check" style={{ flexDirection: 'row', alignItems: 'center' }}>All day</label>
          </div>

          <div className="row-2">
            <label>
              Start
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </label>
            <label>
              End
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </label>
          </div>

          <label>
            Color
            <div className="tag-pick">
              {TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`tag-swatch ${t} ${tag === t ? 'selected' : ''}`}
                  onClick={() => setTag(t)}
                  aria-label={t}
                />
              ))}
            </div>
          </label>

          {conflicts.length > 0 && (
            <div className="modal-conflicts">
              <strong>Conflicts with</strong>
              <ul>
                {conflicts.map(c => <li key={c.id}>{c.title}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-foot">
          {mode === 'edit' && (
            <button className="chip modal-btn-delete" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
          <button className="chip" onClick={onClose}>Cancel</button>
          <button
            className="chip primary"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
