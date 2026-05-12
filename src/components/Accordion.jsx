import { useState } from 'react'

// Uncontrolled wrapper — caller drops <AccordionSection title="..."> children
// inside. Mobile collapses by default; desktop stays open (single-open mode
// only enforced when `singleOpen` is true and parent passes openId).
export function AccordionSection({ title, subtitle, defaultOpen = false, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`panel glass accordion-section ${open ? 'is-open' : ''} ${className}`}>
      <button
        className="accordion-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        type="button"
      >
        <span className="accordion-title">
          <h3>{title}</h3>
          {subtitle && <span className="muted">{subtitle}</span>}
        </span>
        <span className={`accordion-chev ${open ? 'is-open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </section>
  )
}
