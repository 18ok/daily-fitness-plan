# Conservative Structure Maintenance Design

Date: 2026-07-10
Status: Approved for planning

## Objective

Improve the project's maintainability by decomposing oversized source files into clear feature and shared-module boundaries while preserving all existing user-visible behavior, data formats, and integrations.

This phase is structural maintenance only. Visual redesigns, interaction changes, new features, and product behavior changes are explicitly deferred to later page-by-page iterations.

## Current State

The application is a React 19 and Vite single-page application with Supabase-backed authentication and snapshot synchronization. It is mobile-first and currently contains these primary areas:

- Today's plan generation
- Daily completion and wellbeing records
- Plan template library
- Energy sticker collection
- Profile, preferences, authentication, and cloud synchronization
- Plan and cycle calendar

The data and persistence layers have already begun to separate into `src/data`, `src/hooks`, and `src/lib`. The main maintainability risks are concentrated in:

- `src/App.jsx`: 1,547 lines containing the application shell, five pages, shared UI components, plan-generation logic, profile state, authentication, and synchronization.
- `src/styles.css`: 3,608 lines containing global, shell, component, feature, modal, and responsive styles.
- `src/components/PlanCalendar.jsx`: 474 lines combining calendar presentation, cycle-record editing, state, and synchronization.
- Automated coverage: cycle-tracking logic is tested, but plan generation, record feedback, page navigation, persistence, and basic UI flows are not.

The production build and existing cycle-tracking tests pass before this work begins.

## Scope

### Included

- Extract the React startup entry from the application shell.
- Split each page into a feature module.
- Move shared presentational components into common component modules.
- Move pure plan-generation and record-feedback calculations into feature-local logic modules.
- Move the existing calendar into the feature directory without changing its behavior.
- Split the stylesheet by responsibility while preserving selector contents and source order.
- Add focused regression tests for extracted pure logic.
- Add browser smoke coverage for primary navigation and overlays.
- Document discovered issues that are intentionally deferred.

### Excluded

- UI, copy, layout, animation, or interaction redesigns.
- Changes to DOM structure or CSS class names unless technically required to preserve the current render.
- New routes, React Context, external state libraries, or a TypeScript migration.
- Changes to localStorage key names, stored data shapes, or migration behavior.
- Changes to Supabase tables, policies, authentication method, synchronization priority, or call timing.
- Opportunistic bug fixes that alter existing product behavior.
- Asset conversion, compression, or bundle-performance optimization.

## Target Architecture

```text
src/
|-- main.jsx
|-- App.jsx
|-- components/
|   |-- Header.jsx
|   |-- BottomNavigation.jsx
|   `-- common/
|       |-- ChoiceGroup.jsx
|       |-- OptionChip.jsx
|       |-- ResultCard.jsx
|       `-- Sticker.jsx
|-- features/
|   |-- today/
|   |   |-- TodayPage.jsx
|   |   `-- planBuilder.js
|   |-- record/
|   |   |-- RecordPage.jsx
|   |   `-- recordFeedback.js
|   |-- library/
|   |   |-- LibraryPage.jsx
|   |   `-- TemplateDetailSheet.jsx
|   |-- stickers/
|   |   `-- StickersPage.jsx
|   |-- profile/
|   |   `-- ProfilePage.jsx
|   `-- calendar/
|       `-- PlanCalendar.jsx
|-- data/
|-- hooks/
|-- lib/
`-- styles/
    |-- index.css
    |-- base.css
    |-- shell.css
    `-- features/
        |-- today.css
        |-- record.css
        |-- library.css
        |-- stickers.css
        |-- profile.css
        `-- calendar.css
```

The exact number of common-component files may be reduced when two very small components are only used together. File boundaries should follow responsibility, not maximize file count.

## Dependency Rules

Dependencies flow in one direction:

```text
App -> features -> components / hooks / lib / data
```

- `App.jsx` owns the active tab, calendar-open state, shared daily-plan selections, and the derived plan.
- Feature pages own the same local state they own today.
- Shared components are presentational and do not import feature pages.
- Pure feature logic may depend on static data, but it does not depend on React or browser globals.
- `hooks`, `lib`, and `data` do not import page modules.
- No new global state layer is introduced.

## Behavior And Data Compatibility

The refactor must preserve:

- All visible text and labels.
- Existing DOM hierarchy and CSS class names wherever possible.
- Tab order, click behavior, sheet behavior, and scrolling behavior.
- All localStorage keys and stored value shapes.
- Existing default values and persistence timing.
- Supabase sign-in, sign-out, upload, download, and first-login behavior.
- Existing cloud-versus-local snapshot decisions.
- Existing plan-generation, record-feedback, recommendation, and calendar outputs.
- Existing asset selection and import behavior.

Any discovered issue that requires a behavior change is recorded in the deferred audit list instead of being fixed in this phase.

## Refactoring Sequence

Work proceeds in small, reversible slices:

1. Add regression tests around pure calculations that will move.
2. Extract pure plan-generation and record-feedback logic without changing callers.
3. Extract shared presentational components.
4. Move one feature page at a time, building after every move.
5. Move the calendar module after the main pages remain stable.
6. Reduce `App.jsx` to startup-independent application composition.
7. Create `main.jsx` for React startup.
8. Split CSS in original source order, changing no declarations during the move.
9. Run browser smoke and visual comparison checks.
10. Produce the deferred-risk and future-iteration audit.

If a slice causes unexpected visual or behavioral change, that slice is corrected before the next one starts.

## Error Handling

No new user-facing error model is introduced during structural maintenance. Existing messages and failure handling remain unchanged.

- Authentication and synchronization errors continue to use their current status messages.
- Missing Supabase configuration retains its current disabled-state behavior.
- Invalid or missing persisted values continue to use the current hook and logic fallbacks.
- Extracted pure functions retain their existing return shapes and safe defaults.

Potential improvements to error boundaries, structured error reporting, retry behavior, and telemetry are deferred because they would change runtime behavior.

## Test Strategy

### Baseline

Before moving code:

- Run the production build.
- Run the existing cycle-tracking test script.
- Capture the current application in the same Chromium version, viewport, and deterministic local test state used for final comparison.

### Logic Regression Tests

Use focused tests around behavior that currently lives inside `App.jsx`:

- Plan generation across representative time, status, and condition combinations.
- Record companion text for each supported status.
- Record feedback for representative completion, energy, and appetite combinations.

Tests record existing outputs; they do not redefine desired product behavior.

### Browser Smoke Tests

At a mobile viewport, verify:

- The application loads without console errors.
- Every bottom-navigation tab opens its corresponding page.
- Today's plan selections still produce and persist a plan.
- Record controls update and save.
- Library and sticker detail sheets open and close.
- Profile settings sheets open and close.
- The calendar opens and a cycle-record editor can be opened and dismissed.
- Refresh restores persisted local state.
- The unconfigured or signed-out synchronization state renders correctly for the active environment.

At a desktop viewport, verify that the mobile shell remains correctly framed and usable.

### Visual Compatibility

Capture before-and-after screenshots using the same browser, viewport, local data, and page state. Any visible difference is treated as a regression unless it is solely nondeterministic browser rendering noise.

### Required Commands

The final verification includes at minimum:

```text
npm run build
npm run test:cycle
```

Additional test scripts introduced by the implementation plan must also pass.

## Acceptance Criteria

- Production build succeeds.
- Existing cycle-tracking tests pass.
- New pure-logic regression tests pass.
- Browser smoke checks pass without unexpected console errors.
- Before-and-after screenshots show no visible product change.
- Existing localStorage key names and data shapes remain unchanged.
- Supabase schema and authentication behavior remain unchanged.
- `App.jsx` becomes a small application-composition module rather than a collection of page implementations.
- Styles are organized by shell and feature without declaration-level redesign.
- A deferred audit lists existing issues and proposed page-by-page follow-up order.

## Deferred Page Upgrade Order

After the structural maintenance phase is verified and considered stable, product improvements will be designed and implemented one page at a time in this order:

1. Today's plan
2. Daily record
3. Plan library
4. Energy stickers
5. Profile and synchronization
6. Calendar and cycle records

Each page upgrade receives its own design, plan, implementation, and verification cycle.
