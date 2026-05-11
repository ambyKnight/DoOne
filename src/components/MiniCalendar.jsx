import { useState } from 'react'

export default function MiniCalendar({ events = [] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })

  const monthName = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const firstDow = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const eventDays = new Set(
    events
      .map(e => new Date(e.start))
      .filter(d => d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear())
      .map(d => d.getDate())
  )

  const prev = () => { const x = new Date(month); x.setMonth(x.getMonth() - 1); setMonth(x) }
  const next = () => { const x = new Date(month); x.setMonth(x.getMonth() + 1); setMonth(x) }

  return (
    <>
      <div className="panel-head">
        <h3>{monthName}</h3>
        <div className="mini-nav">
          <button onClick={prev}>‹</button>
          <button onClick={next}>›</button>
        </div>
      </div>
      <div className="mini-grid">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <span key={i} className="mini-dow">{d}</span>
        ))}
        {cells.map((d, i) => {
          const isToday = d && d === today.getDate()
            && month.getMonth() === today.getMonth()
            && month.getFullYear() === today.getFullYear()
          const hasEv = d && eventDays.has(d)
          return (
            <span key={i} className={`mini-day ${isToday ? 'today' : ''} ${!d ? 'empty' : ''}`}>
              {d || ''}
              {hasEv && !isToday && <span className="mini-dot" />}
            </span>
          )
        })}
      </div>
    </>
  )
}
