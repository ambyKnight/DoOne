import React, { useState, useEffect } from 'react'
import Planner from './components/Planner'
import { supabase } from './lib/supabaseClient'
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Clock, 
  Plus, 
  FileText,
  MoreHorizontal
} from 'lucide-react'
import './App.css'

export default function App() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Prepare presentation', done: false },
    { id: 2, text: 'Reply to emails', done: true },
    { id: 3, text: 'Update project doc', done: true },
    { id: 4, text: 'Call with client', done: false },
    { id: 5, text: 'Buy groceries', done: false },
  ])

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const focusPercent = Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) || 0

  return (
    <div className="dayflow-app">


      {/* MAIN GRID */}
      <main className="main-layout">
        
        {/* LEFT COLUMN */}
        <aside className="col-left">
          
          {/* Greeting Card */}
          <div className="glass-card greeting-card">
            <p className="greeting-sub">Good evening, Mantu 👋</p>
            <h1 className="greeting-title">Stay organized,<br/>stay inspired.</h1>
            <p className="greeting-desc">You have <span className="highlight">3 events</span> today.</p>
          </div>

          {/* Upcoming Events */}
          <div className="glass-card upcoming-events-card">
            <div className="card-header">
              <h2>Upcoming Events</h2>
              <a href="#" className="view-all">View all</a>
            </div>
            <div className="event-list">
              <div className="event-item">
                <div className="event-time">09:00 AM</div>
                <div className="event-details">
                  <span className="event-title">Team Standup</span>
                  <span className="event-tag tag-work">Work</span>
                </div>
              </div>
              <div className="event-item">
                <div className="event-time">11:00 AM</div>
                <div className="event-details">
                  <span className="event-title">Design Review</span>
                  <span className="event-tag tag-work">Work</span>
                </div>
              </div>
              <div className="event-item">
                <div className="event-time">03:30 PM</div>
                <div className="event-details">
                  <span className="event-title">Gym Session</span>
                  <span className="event-tag tag-personal">Personal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card quick-actions-card">
            <h2 className="card-title">Quick Actions</h2>
            <div className="actions-grid">
              <div className="action-btn-wrap">
                <button className="round-btn"><Plus size={20} /></button>
                <span>Add Event</span>
              </div>
              <div className="action-btn-wrap">
                <button className="round-btn"><CheckSquare size={20} /></button>
                <span>Add Task</span>
              </div>
              <div className="action-btn-wrap">
                <button className="round-btn"><CalendarIcon size={20} /></button>
                <span>Today</span>
              </div>
              <div className="action-btn-wrap">
                <button className="round-btn"><FileText size={20} /></button>
                <span>Notes</span>
              </div>
            </div>
          </div>

          {/* Quote Card */}
          <div className="glass-card quote-card">
            <span className="quote-mark">“</span>
            <p className="quote-text">The best way to predict the future is to create it.</p>
            <span className="quote-author">- Peter Drucker</span>
          </div>

        </aside>

        {/* CENTER COLUMN (CALENDAR) */}
        <section className="col-center">
          <div className="calendar-glass-wrapper">
            <Planner />
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <aside className="col-right">
          
          {/* Agenda Card */}
          <div className="glass-card agenda-card">
            <div className="card-header">
              <h2>May 20, 2026</h2>
              <a href="#" className="view-all">Today</a>
            </div>
            <div className="agenda-list">
              <div className="agenda-item">
                <div className="agenda-time">09:00 AM</div>
                <div className="agenda-details">
                  <span className="agenda-title">Team Standup</span>
                  <span className="agenda-dur">30 min</span>
                </div>
              </div>
              <div className="agenda-item">
                <div className="agenda-time">11:00 AM</div>
                <div className="agenda-details">
                  <span className="agenda-title">Design Review</span>
                  <span className="agenda-dur">1 hr</span>
                </div>
              </div>
              <div className="agenda-item">
                <div className="agenda-time">03:30 PM</div>
                <div className="agenda-details">
                  <span className="agenda-title">Gym Session</span>
                  <span className="agenda-dur">1 hr</span>
                </div>
              </div>
            </div>
            <button className="add-event-btn"><Plus size={16} /> Add Event</button>
          </div>

          {/* Tasks Card */}
          <div className="glass-card tasks-card">
            <div className="card-header">
              <h2>Tasks</h2>
              <a href="#" className="view-all">View all</a>
            </div>
            <div className="task-list">
              {tasks.map(task => (
                <label key={task.id} className="task-item">
                  <input 
                    type="checkbox" 
                    checked={task.done} 
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="custom-checkbox"></span>
                  <span className={`task-text ${task.done ? 'done' : ''}`}>{task.text}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Focus Card */}
          <div className="glass-card focus-card">
            <div className="card-header">
              <h2>Focus</h2>
              <button className="icon-btn-small"><MoreHorizontal size={16} /></button>
            </div>
            <div className="focus-ring-container">
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle className="progress-ring-bg" cx="60" cy="60" r="50"></circle>
                <circle 
                  className="progress-ring-fill" 
                  cx="60" cy="60" r="50"
                  strokeDasharray="314"
                  strokeDashoffset={314 - (314 * focusPercent) / 100}
                ></circle>
              </svg>
              <div className="focus-percent">
                <span className="percent-num">{focusPercent}%</span>
                <span className="percent-label">of daily goal</span>
              </div>
            </div>
            <p className="focus-msg">✨ Great progress today!</p>
          </div>

        </aside>

      </main>
    </div>
  )
}
