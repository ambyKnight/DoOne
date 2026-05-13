# Day Planner — CLAUDE.md

## What This Project Is

A personal daily planner web app with a glassmorphism UI. Features an interactive calendar (FullCalendar), task management, a focus progress ring, and an AI agent tools layer designed for LLM-driven scheduling.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 8 |
| Calendar | FullCalendar 6 (daygrid, timegrid, interaction plugins) |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| Icons | lucide-react |
| Styling | Plain CSS3, glassmorphism |
| Language | JavaScript (JSX) |

## Project Structure

```
src/
  App.jsx             # Root layout — 3-column grid (sidebar | calendar | sidebar)
  App.css             # Layout, cards, focus ring, quote styles
  index.css           # Global styles + FullCalendar overrides
  components/
    Planner.jsx       # FullCalendar wrapper — event CRUD + Supabase Realtime
  lib/
    supabaseClient.js # Supabase singleton client
  ai-agent/
    tools.js          # LLM-callable tools (create/update/delete/search/free-slot detection)
supabase-setup.sql    # DB schema + RLS policies (run once in Supabase SQL editor)
.env.example          # Copy to .env and fill in Supabase credentials
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Dev Commands

```bash
npm install      # install deps
npm run dev      # start dev server (Vite)
npm run build    # production build
npm run preview  # preview production build
npm run lint     # ESLint
```

## Database

Schema lives in `supabase-setup.sql`. Run it once in the Supabase SQL editor to create the `events` table and enable Realtime.

Table: `public.events` — `id (uuid)`, `title (text)`, `start_time (timestamptz)`, `end_time (timestamptz)`, `all_day (boolean)`, `created_at (timestamptz)`

RLS is enabled but policies are permissive (no auth required) — demo mode only.

## Architecture Notes

- **Events**: Persisted in Supabase. `Planner.jsx` subscribes to Postgres changes and refetches on any INSERT/UPDATE/DELETE so the calendar stays live.
- **Tasks**: Currently hardcoded in `App.jsx` local state — not persisted.
- **AI Tools** (`src/ai-agent/tools.js`): Standalone async functions built for LLM agents. Includes event CRUD, fuzzy search, conflict checking, and free-slot finding. Not wired to the UI yet.
- **Focus Ring**: SVG `stroke-dashoffset` driven by the ratio of completed tasks — circumference is 314px.

## Design System

- Font: `Outfit` (Google Fonts, weights 300–700)
- Glassmorphism: `backdrop-filter: blur()`, semi-transparent white backgrounds, 1px white borders
- Color palette: Pink/magenta background, white text, glass cards at ~10–30% opacity
- Border radius: 16–24px on cards, 12px on buttons
- FullCalendar is extensively restyled in `index.css` to match the glass theme

## Known Gaps / TODOs

- Task persistence (no Supabase table yet, state is hardcoded)
- User authentication (RLS policies are wide-open)
- Mobile responsiveness (fixed 3-column grid)
- LLM UI integration (tools.js exists but has no UI entry point)
