import { useRef, useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import EventFormModal from '../components/EventFormModal'
import { supabase } from '../lib/supabaseClient'

function toDateTimeLocal(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function toDateInput(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function CalendarPage({ events, calView, setCalView, isMobile }) {
  const calRef = useRef(null)
  const [title, setTitle] = useState('')
  const [modal, setModal] = useState({ open: false, mode: 'create', defaultValues: {} })

  // On mobile, month grid is unreadable; switch to listWeek by default the
  // first time the mobile branch mounts (unless user explicitly chose a view).
  const effectiveView = isMobile && calView === 'dayGridMonth' ? 'listWeek' : calView

  useEffect(() => {
    if (calRef.current) calRef.current.getApi().changeView(effectiveView)
  }, [effectiveView])

  // FullCalendar with height="100%" sometimes measures its parent at 0 (e.g.
  // mounting inside a flex column whose siblings haven't sized yet). Force a
  // resize once layout settles + on every window resize so it claims the full
  // calendar-panel height.
  useEffect(() => {
    if (!calRef.current) return
    const api = calRef.current.getApi()
    const ro = new ResizeObserver(() => api.updateSize())
    const host = document.querySelector('.calendar-panel')
    if (host) ro.observe(host)
    const t = setTimeout(() => api.updateSize(), 60)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [])

  function handleDateClick(info) {
    const startDate = info.date
    const endDate = info.allDay ? null : new Date(startDate.getTime() + 60 * 60 * 1000)
    setModal({
      open: true, mode: 'create',
      defaultValues: {
        allDay: info.allDay,
        startTime: info.allDay ? info.dateStr : toDateTimeLocal(startDate),
        endTime: endDate ? toDateTimeLocal(endDate) : '',
        tag: 'ev-tag1',
      },
    })
  }

  function handleEventClick(info) {
    info.jsEvent.preventDefault()
    const ev = info.event
    setModal({
      open: true, mode: 'edit',
      defaultValues: {
        id: ev.id, title: ev.title, allDay: ev.allDay,
        startTime: ev.allDay ? toDateInput(ev.start) : toDateTimeLocal(ev.start),
        endTime: ev.end ? (ev.allDay ? toDateInput(ev.end) : toDateTimeLocal(ev.end)) : '',
        tag: ev.classNames.find(c => c.startsWith('ev-tag')) || 'ev-tag1',
      },
    })
  }

  async function handleEventDrop(info) {
    const startTime = info.event.start ? new Date(info.event.start).toISOString() : info.event.startStr
    const endTime = info.event.end ? new Date(info.event.end).toISOString() : (info.event.endStr ? new Date(info.event.endStr).toISOString() : null)
    const { error } = await supabase.from('events')
      .update({ start_time: startTime, end_time: endTime, all_day: info.event.allDay })
      .eq('id', info.event.id)
    if (error) { console.error('Drop error:', error); info.revert() }
  }

  async function handleEventResize(info) {
    const startTime = info.event.start ? new Date(info.event.start).toISOString() : info.event.startStr
    const endTime = info.event.end ? new Date(info.event.end).toISOString() : (info.event.endStr ? new Date(info.event.endStr).toISOString() : null)
    const { error } = await supabase.from('events')
      .update({ start_time: startTime, end_time: endTime })
      .eq('id', info.event.id)
    if (error) { console.error(error); info.revert() }
  }

  const fcEvents = events.map(e => ({
    ...e,
    classNames: [e.tag || 'ev-tag1'],
  }))

  return (
    <div className="page calendar-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">calendar</div>
          <h1 className="page-title">{title || 'Calendar'}</h1>
        </div>
        <div className="header-tools">
          <div className="seg">
            <button onClick={() => calRef.current?.getApi().prev()}>‹</button>
            <button onClick={() => calRef.current?.getApi().today()}>today</button>
            <button onClick={() => calRef.current?.getApi().next()}>›</button>
          </div>
          <div className="seg">
            {(isMobile
              ? [['listWeek','List']]
              : [['dayGridMonth','Month'],['timeGridWeek','Week'],['timeGridDay','Day']]
            ).map(([v, l]) => (
              <button key={v} className={effectiveView === v ? 'on' : ''} onClick={() => setCalView(v)}>{l}</button>
            ))}
          </div>
          <button className="chip primary" onClick={() => setModal({ open: true, mode: 'create', defaultValues: { allDay: true, startTime: toDateInput(new Date()), endTime: '', tag: 'ev-tag1' } })}>
            <PlusIcon width="14" height="14" /> add
          </button>
        </div>
      </header>

      <section className="panel glass calendar-panel">
        <div className="fc-host">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={effectiveView}
            headerToolbar={false}
            events={fcEvents}
            editable={true}
            selectable={true}
            nowIndicator={true}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            slotDuration="01:00:00"
            dayMaxEvents={3}
            firstDay={1}
            expandRows={true}
            height="auto"
            datesSet={info => setTitle(info.view.title)}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
          />
        </div>
      </section>

      {modal.open && (
        <EventFormModal
          mode={modal.mode}
          defaultValues={modal.defaultValues}
          onClose={() => setModal(m => ({ ...m, open: false }))}
        />
      )}
    </div>
  )
}

function PlusIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
}
