# Structure Maintenance Audit

Date: 2026-07-10

## Current Structure

- `App.jsx` is the composition root. Page implementations live under `src/features/`.
- Dependency flow remains `App -> features -> components/hooks/lib/data`.
- The localStorage key set is unchanged from the pre-refactor baseline.
- `supabase/` is unchanged by this maintenance phase.
- Browser smoke coverage starts an isolated Vite server and checks the five primary pages plus the calendar while collecting uncaught page errors and console errors.

## Deferred Work

- **High priority:** `LibraryPage.jsx` contains an existing nested-button template card. React reports this invalid DOM nesting when the page renders. Browser smoke requires the exact two known console entries in their captured order, separately requires zero page errors, and fails on every other result; fix it during the Library redesign without changing it in this behavior-preservation phase.
- `ProfilePage.jsx` remains intentionally large because extracting authentication and synchronization could change effect timing.
- `PlanCalendar.jsx` still combines presentation, editor state, local persistence, and remote synchronization.
- The production JavaScript bundle remains approximately 487 KB before gzip and is not optimized in this phase.
- Several sticker assets remain above 100 KB and are not converted or compressed in this phase.
- Browser smoke does not validate a live Supabase account or destructive cloud restore.
- Page redesign work follows this order: Today, Record, Library, Stickers, Profile, Calendar.

These items are recorded for later work and are intentionally not changed as part of the conservative structure maintenance phase.
