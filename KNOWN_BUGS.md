# Known Bugs

## Settings desync — clicks/slider changes randomly revert

**Status:** Open. Multiple fix attempts have not resolved it.

**Symptom**
When changing a setting in the Settings page (theme color swatch, vibe/surface preset, any Atelier slider, the Disable Wallpaper toggle), there is an intermittent chance the change is visually applied for a moment and then reverts to the previous value. Same input clicked again may stick. Reproduces on both desktop and mobile layouts.

**Affected controls**
- Theme color palette swatches (`setSurfaceDial('baseColor', …)`)
- Vibe / Surface preset cards
- Atelier sliders (`vibeDials`, `surfaceDials`, `surfaceAlpha`, `blurAmount`, `panelGap`)
- `Disable wallpaper` toggle

**Suspected mechanism**
Local state is being overwritten by a stale `user_preferences` row applied via `applyPrefRow`. The overwrite source is one of:
- Realtime `UPDATE` echo on the `user_preferences` table (despite filtering)
- A re-run of the main App effect that re-fetches prefs

**Fixes attempted (currently in tree, none sufficient)**
1. Self-echo filter using `updated_at` watermark in the realtime UPDATE handler
   (`src/App.jsx` — `lastOwnUpdatedAtRef`).
2. `wallpaperOff` setter gated by `prefsLoadedRef` inside `applyPrefRow`
   (only honour DB value on initial load).
3. Diagnostic `console.warn('[prefs echo] applying remote row', …)` to surface
   any remote-row applications.
4. `onAuthStateChange` in `src/lib/authContext.jsx` preserves the `user` object
   reference when `user.id` is unchanged — to stop token-refresh events from
   re-triggering the main effect.
5. Main App effect changed to depend on `user?.id` instead of `user`.

**Hypotheses still on the table**
- Load-race: user interacts with Settings before the initial
  `supabase.from('user_preferences').select()` resolves, and the load's
  `applyPrefRow` then clobbers the in-flight local change. Save effect is
  gated by `prefsLoadedRef.current` so the local change is also not persisted.
- A second realtime subscription / another component fetching prefs and
  setting state.
- Postgres `update_at` being rewritten by a (yet-unidentified) trigger or
  PostgREST behaviour, so the echo's `updated_at` exceeds our watermark and
  the filter fails.
- `prefFingerprint` not deterministic across `jsonb` round-trip (key order)
  causing the fallback path to also miss.

**Next things to try**
- Inline-log every place that calls `applyPrefRow` (load callback as well as
  realtime handler) with the row's `updated_at` and the current watermark, to
  see which call site actually fires during a revert.
- Replace `applyPrefRow` with a per-field merge that refuses to overwrite a
  field whose local value differs from the last value we read from / wrote to
  the DB (true CRDT-ish behaviour).
- Add a global "dirty" ref set by every UI handler in `SettingsPage` and
  short-circuit `applyPrefRow` while it is set.
- Check the Postgres side for any `BEFORE UPDATE` trigger on
  `user_preferences` that touches `updated_at`.

**Workaround**
Click the control again until it sticks. The change persists once the local
value matches what the next echo carries.
