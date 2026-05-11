import React, { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { supabase } from '../lib/supabaseClient'

export default function Planner() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    fetchEvents()

    const channel = supabase
      .channel('public:events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('Change received!', payload)
          // Simple approach: just re-fetch everything on any change
          // For a production app, we would update the state locally based on the payload type (INSERT, UPDATE, DELETE)
          fetchEvents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*')
    if (error) {
      console.error('Error fetching events:', error)
    } else {
      const formattedEvents = data.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start_time,
        end: e.end_time,
        allDay: e.all_day
      }))
      setEvents(formattedEvents)
    }
  }

  const handleDateSelect = async (selectInfo) => {
    let title = prompt('Please enter a new title for your event')
    let calendarApi = selectInfo.view.calendar

    calendarApi.unselect() // clear date selection

    if (title) {
      const newEvent = {
        title,
        start_time: selectInfo.startStr,
        end_time: selectInfo.endStr,
        all_day: selectInfo.allDay
      }
      
      // Optimistic UI update could go here
      const { data, error } = await supabase
        .from('events')
        .insert([newEvent])
        .select()
        
      if (error) {
        console.error('Error creating event:', error)
        alert('Could not create event. Ensure Supabase credentials and schema are setup.')
      } else if (data && data.length > 0) {
        // Event is added via realtime or we can just fetch it manually if we want
        calendarApi.addEvent({
          id: data[0].id,
          title: data[0].title,
          start: data[0].start_time,
          end: data[0].end_time,
          allDay: data[0].all_day
        })
      }
    }
  }

  const handleEventClick = async (clickInfo) => {
    if (confirm(`Are you sure you want to delete the event '${clickInfo.event.title}'`)) {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', clickInfo.event.id)
        
      if (error) {
        console.error('Error deleting event:', error)
      } else {
        clickInfo.event.remove()
      }
    }
  }

  const handleEventDrop = async (dropInfo) => {
    const { event } = dropInfo;
    const { error } = await supabase
      .from('events')
      .update({
        start_time: event.startStr,
        end_time: event.endStr,
        all_day: event.allDay
      })
      .eq('id', event.id)
      
    if (error) {
        console.error('Error updating event:', error)
        dropInfo.revert();
    }
  }
  
  const handleEventResize = async (resizeInfo) => {
    const { event } = resizeInfo;
    const { error } = await supabase
      .from('events')
      .update({
        start_time: event.startStr,
        end_time: event.endStr,
        all_day: event.allDay
      })
      .eq('id', event.id)
      
    if (error) {
        console.error('Error updating event:', error)
        resizeInfo.revert();
    }
  }

  return (
    <div className="planner-container">
      <div className="calendar-wrap">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          initialView="dayGridMonth"
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          events={events}
          select={handleDateSelect}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
      </div>
    </div>
  )
}

function renderEventContent(eventInfo) {
  return (
    <div className="custom-event-content">
      <b>{eventInfo.timeText}</b>
      <i>{eventInfo.event.title}</i>
    </div>
  )
}
