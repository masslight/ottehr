# Tracking board timezone behavior — issues and options

**Status:** Discussion draft. No code changes proposed yet.

**Audience:** Product + engineering. Looking for buy-in on the desired behavior before implementing — the codebase has had multiple ad-hoc TZ conversations and this should consolidate them.

## The immediate symptom

An EHR user on a PDT system books an in-person appointment for **1:30 AM EDT on 6/3** via the patient app, then opens the EHR tracking board. The appointment shows up on the **6/2** column, not 6/3.

Concrete instant: `Appointment.start = 2026-06-03T05:30:00.000Z` (UTC — that's how `create-appointment` persists it: see `packages/zambdas/src/patient/appointment/create-appointment/index.ts:229`, which uses `.setZone('UTC').toISO()` for both start and end). Same instant as 1:30 AM EDT or 10:30 PM PDT.

## Root cause

Same pattern as the slot-availability bug we just fixed in `slotAvailableAgainstBusy`: the codebase parses persisted FHIR time strings without `{ setZone: true }` and then performs wall-clock math (`.toFormat('yyyy-MM-dd')`, `.startOf('day')`, etc.). Luxon silently re-anchors to the runtime's local zone, so the bucket boundary is the EHR user's system midnight — not the appointment's Location midnight.

The cure is to anchor wall-clock math to the **Location's stored timezone**, which is the source of truth for "what day is this appointment in" for that Location. The Location's timezone is already available on the fetched appointment data; the consuming code just isn't reading it.

## The three affected sites

| # | File:line | What it does | Symptom |
|---|---|---|---|
| 1 | `apps/ehr/src/pages/Appointments.tsx:79` | Passes `timezone: DateTime.now().zoneName` (the EHR user's system zone) to `getAppointments`. The server uses this to compute the UTC range for "the selected date in TZ." | **Root of the 6/2 vs 6/3 symptom.** With PDT passed, the server queries `2026-06-03T07:00:00Z`–`2026-06-04T06:59:59Z` for "6/3," so the 1:30 AM EDT (= 5:30 UTC) appointment falls in the previous PDT bucket. |
| 2 | `apps/ehr/src/components/AppointmentTableRow.tsx:227` | Formats the displayed time via `DateTime.fromISO(appointment.start).toFormat('h:mm a')` — no `setZone`. | Each row's start time is rendered in the EHR user's local zone, not the appointment's Location zone. A 1:30 AM EDT row shows as "10:30 PM" on a PDT system. |
| 3 | `apps/ehr/src/components/AppointmentsFilters.tsx:107` | Filter date input defaults to `DateTime.now().toISODate()` — today in the EHR user's system zone. | First-load default may be off-by-one in edge cases (e.g., midnight in the user's zone vs the Location's). Less severe; the user typically picks a date anyway. |

## Why this never came up cleanly before

Single-location single-TZ deployments don't hit it — when the EHR runs in the Location's timezone, system zone == Location zone, and everything coincidentally works. The bug surfaces when:
- The EHR user is in a different physical zone from the Location (remote/distributed teams)
- The tracking board view spans Locations in different zones
- CI/automation servers run in UTC

## What "correct" means — product questions for the team

The bug clearly produces wrong output. But "correct" has several plausible shapes, and the choice affects UX:

### Q1: What timezone should the **filter date** and **server bucket** use?

- **(a) The selected Location's TZ.** "6/3 at this Location" is unambiguous. Simple when one Location is selected. Awkward when multiple are selected (no single right answer).
- **(b) A user preference / project default.** EHR admin picks a "primary timezone for tracking" once; that drives all bucketing regardless of which Locations the user filters to. Consistent UX across sessions; doesn't follow the Location.
- **(c) The EHR user's system zone (current behavior).** Wrong in cross-zone cases, but matches what's on the user's wall clock. Probably what some users have learned to expect.

Recommendation if voting: **(a) with fallback** — selected Location's TZ when exactly one Location is filtered; first selected Location's TZ when multiple; user's system zone when no Location filter (e.g., provider- or service-category-only filter).

### Q2: What timezone should the **displayed start time** on each row use?

- **(a) The appointment's own Location TZ — per row.** A multi-Location board would show some rows in EDT and others in PDT, each labeled with their zone. Semantically right; visually busier (need TZ labels or implicit "your Location" interpretation).
- **(b) The board-level TZ from Q1.** Every row displays in the same zone — easier to scan, but a row's displayed time may not match what the *patient* sees in their booking confirmation.
- **(c) System zone (current behavior).** Avoids per-row variability; not anchored to anything meaningful.

Recommendation if voting: **(a)**, with a small TZ label suffix when the row's TZ differs from the board's primary TZ (so single-Location views — the common case — stay clean and multi-Location views remain readable). This matches what the patient saw.

### Q3: What should the **filter date default** show on first load?

- **(a) Today in the eventual board TZ (per Q1).** Requires resolving the Location's TZ before defaulting; awkward when no Location is yet selected.
- **(b) Today in system zone (current behavior).** Wrong in edge cases but no extra dependency at first load. User typically picks a date anyway.
- **(c) Sticky from last session (localStorage).** Already partially implemented (`AppointmentsFilters.tsx:100-102`). Could rely on this and ignore the default for the first-ever load.

Recommendation if voting: **(b)** — leave the default as-is, fix the bucketing (Q1) so the date the user picks is interpreted correctly. The first-load edge case is rare and the fix would add complexity disproportionate to the value.

## Implementation outline (once direction is chosen)

1. **New hook**: `useSelectedBoardTimezone(locationIds: string[]): string | undefined` — fetches the first selected Location and returns its `getTimezone(...)` value. Caches via React Query. Returns `undefined` when no Location is selected (caller falls back as desired).
2. **`Appointments.tsx:79`**: replace `DateTime.now().zoneName` with the resolved board TZ (or fallback per Q1).
3. **`AppointmentTableRow.tsx:227`**: format with `.setZone(getTimezone(row.location))` per Q2.
4. **Optionally**: `AppointmentsFilters.tsx:107` — leave as-is per Q3, or rework if (a) is chosen.

No server-side changes — `packages/zambdas/src/ehr/get-appointments/helpers.ts:168-170` already does `DateTime.fromISO(searchDate, { zone: timezone })` correctly; it just needs the right `timezone` passed in.

## Why this matters beyond this one bug

The codebase has the **`DateTime.fromISO` without `setZone: true` → wall-clock-on-local-zone** footgun in several places (saved as a feedback memory after the `slotAvailableAgainstBusy` fix). Each instance fails open in single-zone deployments and bites in multi-zone or CI scenarios. The tracking board is just the most visible one. Worth a broader audit at some point, but each site needs the same Q1/Q2-style product call about which TZ is canonical for that view.

## Related work / context

- **Fixed:** `packages/utils/lib/utils/scheduleUtils.ts` `slotAvailableAgainstBusy` — same root cause; surfaced as CI vs local divergence in intake e2e tests.
- **Persistence convention:** `create-appointment` writes `Appointment.start/end` in UTC. The Location's TZ is *not* encoded on the Appointment itself — it lives on the Location resource. Every reader of `Appointment.start` is responsible for re-anchoring to the Location's TZ before doing wall-clock math.
- **Memory:** `feedback_datetime_setzone` — codifies the rule for future sessions/contributors.
