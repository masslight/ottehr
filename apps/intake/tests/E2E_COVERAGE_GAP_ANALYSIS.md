# E2E Test Coverage Gap Analysis

This document analyzes the coverage delta between the legacy e2e tests (`tests/specs/`) and the new generated booking flow tests (`tests/e2e/booking-flows-generated.spec.ts`). It identifies gaps and proposes a prioritized plan for addressing them.

## Current Coverage Summary

### New Tests (`booking-flows-generated.spec.ts`)

The new tests provide comprehensive coverage of **new patient booking flows**:

| Dimension | Coverage |
|-----------|----------|
| Visit Types | Walk-in, Prebook |
| Service Modes | In-person, Virtual |
| Service Categories | Urgent Care, Occupational Medicine, Workers Comp |
| Patient Type | **New patients only** |
| Paperwork | Full flow through all enabled pages |
| Completion | Verified arrival at correct completion page |

**Strengths:**
- Config-aware: automatically adapts to different questionnaire configurations
- Parallelized: runs all scenarios concurrently with isolated test resources
- Self-contained: creates its own test locations and questionnaires
- Validates end-to-end flow from homepage through paperwork submission

### Legacy Tests (`tests/specs/`)

The legacy tests cover additional scenarios not yet in the new tests:

#### In-Person Tests
| Test File | Coverage |
|-----------|----------|
| `PaperworkExistingPatient.spec.ts` | Returning patient with prefilled data (RP: not self, Payment: Insurance) |
| `PaperworkExisitingPatientSelf.spec.ts` | Returning patient (RP: Self, Payment: Card) |
| `PaperworkReviewScreen.spec.ts` | Review page chips, edit button navigation |
| `PastVisits.spec.ts` | Past visits empty state, appointment list |
| `ReservationModification.spec.ts` | Modify time slot, cancel visit, book again |
| `ReservationScreen.spec.ts` | Booking confirmation screen data verification |

#### Telemed Tests
| Test File | Coverage |
|-----------|----------|
| `PaperworkTelemedExistingPatient.spec.ts` | Returning patient prefilled data |
| `PaperworkTelemedExistingPatientSelf.spec.ts` | Returning patient (RP: Self) |
| `PaperworkTelemedReviewScreen.spec.ts` | Review page verification |
| `WaitingRoom.spec.ts` | Invite/cancel participant (phone/email) |
| `homepage.spec.ts` | Homepage navigation, Support dialog |

---

## Coverage Gaps

### Priority 1: Critical User Journeys ✅ COMPLETED

#### 1.1 Returning/Existing Patient Flow ✅
**Status:** Implemented in `ExtendedScenarioHelpers.ts` → `executeReturningPatientFlow()`

**Coverage added:**
- Patient selection screen detection
- Selection of existing patient from list
- Navigation to paperwork with prefilled data
- Basic verification of prefilled email field

**Implementation notes:**
- Attached to first in-person walk-in scenario per config
- Starts a NEW booking flow after initial appointment creation
- Verifies patient selection UI appears and works

#### 1.2 Reservation Modification & Cancellation ✅
**Status:** Implemented in `ExtendedScenarioHelpers.ts`

**Modification flow** (`executeModificationFlow()`):
- Navigate to `/visit/{appointmentId}`
- Click Modify button → reschedule page
- Select different time slot
- Click "Modify to [date/time]" button
- Verify thank you page with new time

**Cancellation flow** (`executeCancellationFlow()`):
- Navigate to `/visit/{appointmentId}`
- Click Cancel button → cancel page
- Select cancellation reason from dropdown
- Click "Cancel Visit" button
- Verify cancellation confirmation page
- Click "Book Again" → verify return to homepage

**Implementation notes:**
- Modification attached to first prebook scenario per config
- Cancellation attached to second prebook scenario per config
- Distributed across scenarios to maintain parallelization

---

### Priority 2: Important Features ✅ COMPLETED

#### 2.1 Past Visits Page ✅
**Status:** Implemented in `ExtendedScenarioHelpers.ts` → `executePastVisitsFlow()`

**Coverage added:**
- Navigate to homepage → click Past Visits button
- Patient selection on `/my-patients` page
- Verify arrival at `/my-patients/:patientId/past-visits`
- Verify "Visits" heading visible
- Check for appointment in list (by visit ID)
- Back to homepage navigation

**Implementation notes:**
- Attached to third prebook scenario OR second in-person walk-in per config
- Uses the patient created during the initial booking flow

#### 2.2 Waiting Room Participant Management (Virtual) ✅
**Status:** Implemented in `ExtendedScenarioHelpers.ts` → `executeWaitingRoomParticipantsFlow()`

**Coverage added:**
- Verify waiting room page after virtual walk-in
- Click "Manage participants" → modal opens
- Fill invitee details (first name, last name)
- Select Phone contact method
- Fill phone number and send invite
- Verify invitee appears in participant list
- Cancel invite flow → confirm cancellation
- Verify invitee removed from list

**Implementation notes:**
- Attached to first virtual walk-in scenario per config
- Tests full invite/cancel cycle

#### 2.3 Review Page Detailed Verification ✅
**Status:** Implemented in `ExtendedScenarioHelpers.ts` → `executeReviewPageVerification()`

**Coverage added:**
- Navigate directly to review page
- Verify "Review and submit" heading
- Verify patient name and location displayed
- Check chip statuses (contact info, patient details)
- Edit button navigation (contact info → verify page opens)
- Browser back navigation to review page
- Continue button visibility

**Implementation notes:**
- Attached to fourth prebook scenario OR second virtual walk-in per config
- Tests core review page functionality

### Priority 3: Edge Cases & Variations

#### 3.1 Payment Option Variations
**Gap:** New tests use a single payment path per flow.

**What's missing:**
- Switching between payment options (Insurance ↔ Self-pay)
- Secondary insurance flow
- Saved card selection vs new card entry
- Policy holder relationship variations

**Recommendation:** Component tests for payment option switching logic. E2e for one happy path per payment type.

**Effort:** Low-Medium

#### 3.2 Responsible Party Variations
**Gap:** New tests default to "Self" responsible party.

**What's missing:**
- Non-self responsible party (prefilled from existing data)
- Responsible party form when relationship ≠ Self

**Recommendation:** Cover in returning patient e2e tests (see 1.1).

**Effort:** Included in 1.1

#### 3.3 Support Dialog
**Gap:** No coverage for support functionality.

**What's missing:**
- Support button opens dialog
- Dialog content verification
- Contact information display

**Recommendation:** Component test - isolated UI feature.

**Effort:** Low

---

## Proposed Plan

### Phase 1: Critical Path Coverage (Priority 1) ✅ COMPLETED

1. **Returning Patient Flow** (1.1) ✅
   - Implemented via `executeReturningPatientFlow()` in `ExtendedScenarioHelpers.ts`
   - Uses newly created patient from initial booking
   - Verifies patient selection screen and prefilled data

2. **Reservation Modification/Cancellation** (1.2) ✅
   - Implemented via `executeModificationFlow()` and `executeCancellationFlow()`
   - Tests modify → new time slot → confirmation
   - Tests cancel → reason selection → cancellation confirmation → book again

### Phase 2: Important Feature Coverage (Priority 2) ✅ COMPLETED

3. **Past Visits** (2.1) ✅
   - Implemented via `executePastVisitsFlow()` in `ExtendedScenarioHelpers.ts`
   - Verifies navigation to past visits and appointment display
   - Tests back to homepage navigation

4. **Waiting Room Participant Management** (2.2) ✅
   - Implemented via `executeWaitingRoomParticipantsFlow()` in `ExtendedScenarioHelpers.ts`
   - Tests invite by phone flow
   - Tests cancel invite flow

5. **Review Page Deep Testing** (2.3) ✅
   - Implemented via `executeReviewPageVerification()` in `ExtendedScenarioHelpers.ts`
   - Tests chip status display
   - Tests edit button navigation

### Phase 3: Component Test Migration (Priority 3) ← REMAINING

These features are better suited for component/integration tests:

| Feature | Reason |
|---------|--------|
| Payment option switching | UI logic, doesn't need full flow |
| Support dialog | Isolated component |
| Form field validation messages | Input validation logic |
| Link opening (PDF, external) | Browser behavior |

---

## Implementation Notes

### For Returning Patient Flow

The new e2e infrastructure already supports:
- Authenticated sessions (via `storageState: './playwright/user.json'`)
- Login flow (via `tests/login/login.spec.ts`)

To add returning patient coverage:
1. Use the same authenticated session from login
2. Navigate to homepage and select an existing patient
3. Start a booking flow
4. Verify prefilled data on each paperwork page

### For Post-Booking Flows

The new tests already capture `appointmentResponse.appointmentId`. This can be used to:
1. Navigate to `/visit/{appointmentId}` after booking
2. Test modification and cancellation flows
3. Test past visits page with known appointment data

### Test Data Strategy

Legacy tests used a "setup" phase that created test patients with specific configurations. The new approach should:
1. Use dynamically created test data where possible
2. Leverage the existing login user's patient data for returning patient tests
3. Clean up test data after runs to avoid pollution

---

## Summary

| Gap | Priority | Approach | Status |
|-----|----------|----------|--------|
| Returning patient flow | P1 | E2E | ✅ Done |
| Reservation modification/cancel | P1 | E2E | ✅ Done |
| Past visits page | P2 | E2E | Pending |
| Waiting room participants | P2 | E2E | Pending |
| Review page deep testing | P2 | E2E + Component | Pending |
| Payment option variations | P3 | Component | Pending |
| Support dialog | P3 | Component | Pending |

**Remaining work:**
- P2 items: 3 features (Past visits, Waiting room, Review page)
- P3 items: 2 features (Payment variations, Support dialog) - better as component tests
