# Today Fast Plan Pilot Design

Date: 2026-07-11
Status: Approved in conversation; awaiting written-spec review

## Context

The web application will be tested first with a small group of women who are new to fitness. The immediate goal is not a redesign or another structural refactor. It is to make the existing Today page faster to understand and use, gather reliable feedback, and preserve a clean path to a later WeChat Mini Program.

The current React/Vite structure, plan rules, history shape, Supabase synchronization, and page boundaries remain the baseline. The approved direction is an in-place improvement to `TodayPage`, with the existing illustration library and lightweight motion preserved.

## Goals

- Let a first-time user explicitly describe her day and see a plan within 60 seconds.
- Let a returning user see a useful plan immediately and confirm it with one tap.
- Combine plan confirmation and saving into one clear action.
- Fix touch pinch zoom so a mobile user can zoom in and back out without closing the page.
- Keep training, food, minimum-line, and avoid illustrations helpful but subordinate to the content.
- Collect lightweight, anonymous pilot feedback without requiring sign-in.
- Keep business rules and data portable to a future Taro + React WeChat Mini Program.

## Non-Goals

- No second structural refactor of the application or `TodayPage` hierarchy.
- No redesign of Record, Library, Stickers, Profile, or Calendar.
- No bottom-sheet adjustment flow in this phase.
- No new exercise-tool animation production in this phase.
- No equipment or nutrition education library in this phase.
- No migration to Taro or WeChat Mini Program in this phase.
- No replacement of the varied illustration library with one mascot.

## Product Direction

The product uses a varied illustration and animation ecosystem. Cats, rabbits, bears, frogs, dogs, and future characters may all appear. Consistency applies to asset quality, scale, motion intensity, placement, and purpose, not to forcing every screen to use one character.

Illustrations must help a beginner recognize the purpose or tone of a card. They must not cover text, compete with the primary action, or create constant high-amplitude motion. Existing float and breathe effects remain available and continue to respect reduced-motion preferences.

## Approved Interaction Approach

Use the existing page with progressive disclosure.

### First Visit

1. Treat the user as new when there is no valid daily plan history.
2. Show the existing time, daily-status, and location questions in a compact selector area.
3. Require an explicit selection for all three questions. Do not silently accept the current `30 minutes / after night shift / gym` defaults as real user input.
4. Update the derived plan while selections are made, but keep the result hidden until all three questions have been touched.
5. Reveal the plan as soon as all three answers are complete. Do not require a separate Generate action.
6. Save the plan only when the user taps the primary confirmation action.

### Returning Visit

1. Load the persisted selections and show the derived plan immediately.
2. Present the current time, status, and location as compact summary chips.
3. Provide one clear Adjust action that expands the existing selector controls in place.
4. Update the plan preview immediately when a selection changes.
5. Do not write a new daily history entry until the user confirms the updated plan.

### Confirmation

- Replace the separate Generate and Save sequence with one primary action: `今天就按这个做`.
- Confirmation writes one saved daily-plan entry using the existing history format.
- Reconfirming after adjustments replaces the entry for the same date rather than creating duplicates.
- After confirmation, the primary action reads `今天计划已确认` and does not toggle the plan back to unsaved on an accidental second tap.

## Page Composition

The approved visual direction combines option A with the useful parts of option B:

- Keep option A's complete, results-first plan presentation.
- Keep the compact selection summary and adjacent Adjust action.
- Add option B's one-sentence daily strategy above the detailed result cards.
- Make the confirmation action visually strong and easy to reach with one thumb.
- Retain the existing training, food, minimum-line, and avoid cards and their illustrations.
- Preserve the current page/component ownership; implement the composition through conditional rendering and CSS within the existing Today feature.

The future experience-enhancement phase may move the Adjust controls into a bottom sheet after the in-place flow is proven. That phase will reuse the same three fields and plan generator rather than introducing a second behavior model.

## State and Data Behavior

- Existing plan selections remain `{ time, status, condition }`.
- Existing daily plan history remains the source of confirmed plans.
- First-visit completion tracking is transient UI state; it does not change the stored plan schema.
- The derived plan remains produced by the current pure `buildPlan` logic.
- A selection change only changes the preview until confirmation.
- If browser storage is unavailable, planning still works for the current session and the UI explains that long-term saving is unavailable.
- No cycle, profile, authentication, or cloud snapshot shapes change as part of the Today flow.

## Mobile Zoom Fix

The viewport metadata already permits zoom. The blocking rule is the Today/page scroll container's `touch-action: pan-y`, which excludes pinch zoom on the main interactive surface.

The implementation will allow both vertical panning and pinch zoom on mobile content. Acceptance requires:

- Two-finger zoom-in works on the Today page.
- Two-finger zoom-out returns to the original scale.
- Vertical scrolling still works before and after zooming.
- Buttons and selection controls remain tappable.
- No horizontal layout overlap is introduced at enlarged text or zoom levels.

## Pilot Feedback

After a plan is confirmed, show a lightweight prompt: `这个计划适合你今天吗？`

Choices:

- `适合`
- `太难`
- `不符合状态`

An optional short note allows one sentence of context. A submission contains only:

- Rating choice
- Optional note
- Time, status, and location selections
- Page/content version
- Anonymous client feedback ID
- Submission timestamp

The pilot does not collect names, phone numbers, WeChat IDs, cycle records, or other sensitive health data.

### Feedback Storage

- Add a dedicated Supabase feedback table for the pilot.
- Anonymous clients may insert constrained rows but cannot select, update, or delete rows.
- Database checks limit rating values and note length.
- One device submits at most one feedback row for the same confirmed plan.
- If submission fails, retain a local pending item and retry on a later app open.
- If Supabase is unavailable or unconfigured, the planning flow remains usable and feedback stays queued locally.
- The owner reviews and exports feedback through the Supabase dashboard.

For a larger public test, anonymous direct insertion will be replaced by a Supabase Edge Function with server-side rate limiting and abuse protection. That infrastructure is intentionally deferred from the friends-only pilot.

## Pilot Method and Success Criteria

Run three small rounds with three to five target users per round.

### Round 1: Can They Use It?

- A first-time user completes the flow without verbal help.
- A first-time user sees and confirms a plan within 60 seconds.
- A returning user confirms an unchanged plan within 15 seconds.
- Users can find Adjust and understand the three current-state chips.
- Pinch zoom works in both directions on their actual phones.

### Round 2: Does It Help?

- Users say whether the plan matches their real day.
- Training and food suggestions are understandable and feasible.
- Illustrations aid recognition without obscuring content.
- Common confusion is grouped by frequency, not by individual preference.

### Round 3: Will They Return?

- Users voluntarily open the page on another day.
- Users trust the recommendation enough to confirm it.
- Feedback identifies which exercise demonstrations and educational explanations are most needed.
- Only the two or three most frequent problems are addressed per iteration.

## Deferred Learning and Media Roadmap

After the fast Today flow succeeds:

1. Add contextual exercise and equipment demonstrations for the current day's plan.
2. Use a future simple-line-animation skill to produce short videos or animated images.
3. Add a beginner education area covering equipment, correct use, reasons for movements, food choices, body impact, and high/low calorie concepts.
4. Continue expanding the illustration and animation library with varied characters.

This phase may reserve content identifiers or link positions, but it will not ship empty or misleading demonstration controls before content exists.

## WeChat Mini Program Migration Baseline

The web pilot remains the first delivery target. After the product flow is validated, create a sibling Taro + React mini-program project rather than replacing the web app.

Reusable assets and logic include:

- Plan generation and record feedback rules
- Cycle calculations
- Recommendation data
- Confirmed data shapes
- Illustration, image, video, and animation assets

Platform-specific work includes:

- Rebuilding page markup with Taro/mini-program components
- Replacing browser storage with a platform storage adapter
- Replacing `window` and `document` interactions
- Adapting navigation, authentication, and network requests
- Adding WeChat login and mapping it to backend users
- Testing package size, real-device behavior, preview, upload, review, and release

Current web work should avoid new browser-only coupling in business logic. It should not trigger a preemptive Taro conversion or broad abstraction work.

## Failure Handling

- Storage failure: keep the current session usable and explain that persistence is unavailable.
- Feedback network failure: queue one constrained local item and retry later without blocking plan confirmation.
- Invalid stored selections: fall back to the first-visit selector, not to a silently generated night-shift plan.
- Missing illustration: retain readable text and card layout without a broken-image box.
- Reduced-motion preference: disable decorative float and breathe motion.

## Verification

Automated checks will cover:

- First visit requires all three explicit selections.
- Plan appears automatically after the third selection.
- Returning visit shows the plan immediately.
- Adjusting a selection updates the preview without premature history writes.
- One confirmation creates one saved entry for the date.
- Reconfirmation replaces the same-day entry.
- The confirmed primary action cannot accidentally unsave the plan.
- Feedback choices and payload are constrained.
- Failed feedback submission is queued without blocking confirmation.
- Existing navigation, persistence, Record, Library, Stickers, Profile, and Calendar smoke flows remain intact.
- The page scroll container permits pinch zoom.
- Production build and the full maintenance verification suite pass.

Manual mobile checks will use at least one iPhone and one Android phone when available, with special attention to pinch zoom, thumb reach, text overlap, animation intensity, and feedback submission.

## Expected Change Boundary

Expected changes are limited to the Today feature, its styles and tests, the touch-action rule, a small feedback repository, and one Supabase feedback migration. Any need to change application-wide architecture, unrelated pages, authentication timing, or existing cloud snapshot behavior requires a separate design decision.
