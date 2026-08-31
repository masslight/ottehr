# E2E Test Coverage Gap Analysis

This document tracks the coverage provided by the generated booking flow tests (`tests/e2e/booking-flows-generated.spec.ts`) and identifies remaining gaps relative to legacy tests and real-world scenarios.

## Current Coverage Summary

### Generated Tests (`booking-flows-generated.spec.ts`)

The generated tests provide comprehensive coverage of booking flows:

| Dimension | Coverage |
|-----------|----------|
| Visit Types | Walk-in, Prebook |
| Service Modes | In-person, Virtual |
| Service Categories | Urgent Care, Occupational Medicine, Workers Comp |
| Patient Types | New patients, Returning patients (via extended scenario) |
| Booking Entity Types | Location-based, Group/HealthcareService-based |
| Paperwork | Full flow through all enabled pages |
| Post-Booking | Modification, Cancellation, Past Visits, Waiting Room |
| Config Types | Synthetic (baseline), Concrete (instance-specific) |

**Test Organization:**
- **Synthetic (baseline):** Tests all booking permutations with baseline config
- **Concrete configs:** Tests instance-specific config overrides (auto-discovered)

**Key Capabilities:**
- Config-aware: automatically adapts to different questionnaire configurations
- Parallelized: 6 workers in CI with isolated test resources per worker
- Self-contained: creates its own test locations, schedules, and questionnaires
- Extended coverage: P1/P2 scenarios distributed across test matrix
- CI-reliable: time slot selection with future buffer, extended timeouts

---

## Completed Coverage

### Priority 1: Critical User Journeys ✅

#### 1.1 New Patient Booking Flow ✅
**Location:** `BookingTestFactory.ts` → `executeBookingScenario()`

**Coverage:**
- Homepage navigation and booking option selection
- Service category selection (when multiple available)
- Patient info form with validation
- Location selection (autocomplete)
- Time slot selection (with 30-min future buffer for CI reliability)
- Booking confirmation and appointment creation
- Full paperwork flow (dynamic page traversal)
- Completion page verification

#### 1.2 Returning/Existing Patient Flow ✅
**Location:** `ExtendedScenarioHelpers.ts` → `executeReturningPatientFlow()`

**Coverage:**
- Patient selection screen detection
- Selection of existing patient from list
- Navigation to paperwork with prefilled data
- Basic verification of prefilled email field

**Distribution:** First in-person walk-in scenario per config

#### 1.3 Reservation Modification ✅
**Location:** `ExtendedScenarioHelpers.ts` → `executeModificationFlow()`

**Coverage:**
- Navigate to `/visit/{appointmentId}`
- Click Modify button → reschedule page
- Select different time slot (with future buffer)
- Click "Modify to [date/time]" button
- Verify thank you page with new time

**Distribution:** First prebook scenario per config

#### 1.4 Reservation Cancellation ✅
**Location:** `ExtendedScenarioHelpers.ts` → `executeCancellationFlow()`

**Coverage:**
- Navigate to `/visit/{appointmentId}`
- Click Cancel button → cancel page
- Select cancellation reason from dropdown
- Click "Cancel Visit" button
- Verify cancellation confirmation page
- Click "Book Again" → verify return to homepage

**Distribution:** Second prebook scenario per config

---

### Priority 2: Important Features ✅

#### 2.1 Past Visits Page ✅
**Location:** `ExtendedScenarioHelpers.ts` → `executePastVisitsFlow()`

**Coverage:**
- Navigate to homepage → click Past Visits button
- Patient selection on `/my-patients` page
- Verify arrival at `/my-patients/:patientId/past-visits`
- Verify "Visits" heading visible
- Check for appointment in list (by visit ID)
- Back to homepage navigation

**Distribution:** Third prebook scenario OR second in-person walk-in per config

#### 2.2 Waiting Room Participant Management ✅
**Location:** `ExtendedScenarioHelpers.ts` → `executeWaitingRoomParticipantsFlow()`

**Coverage:**
- Verify waiting room page after virtual walk-in
- Click "Manage participants" → modal opens
- Fill invitee details (first name, last name)
- Select Phone contact method
- Fill phone number and send invite
- Verify invitee appears in participant list
- Cancel invite flow → confirm cancellation
- Verify invitee removed from list

**Distribution:** First virtual walk-in scenario per config

#### 2.3 Review Page Verification ✅
**Location:** `ExtendedScenarioHelpers.ts` → `executeReviewPageVerification()`

**Coverage:**
- Navigate directly to review page
- Verify "Review and submit" heading
- Verify patient name and location displayed
- Check chip statuses (contact info, patient details)
- Edit button navigation (contact info → verify page opens)
- Browser back navigation to review page
- Continue button visibility

**Distribution:** Fourth prebook scenario OR second virtual walk-in per config

---

### Infrastructure Improvements ✅

#### Group Booking (HealthcareService) Support ✅
**Location:** `TestLocationManager.ts` → `ensurePrebookInPersonGroupWithSlots()`

**Coverage:**
- Creates HealthcareService with Location + Practitioner members
- PractitionerRole linking
- Pooled schedule strategy (combines slots from members)
- Service category characteristic (urgent-care)
- URL-based booking with `bookingOn={slug}&scheduleType=group`

**Distribution:** Urgent care prebook in-person uses Group booking

#### Test Resource Isolation ✅
**Location:** `TestLocationManager.ts`, `TestQuestionnaireManager.ts`

**Coverage:**
- Unique worker ID per parallel test runner
- Isolated test locations with 24/7 schedules
- Isolated test questionnaires per config
- Automatic cleanup after test completion
- Batch deletion for efficiency

#### CI Reliability ✅
**Location:** `BookingFlowHelpers.ts`, `playwright.config.ts`

**Coverage:**
- Time slot selection with 30-minute future buffer
- 6-minute test timeout for extended scenarios
- Questionnaire canonical injection to prevent conflicts

---

## Remaining Gaps

### Priority 3: Edge Cases & Variations

#### 3.1 Payment Option Variations
**Status:** Not covered in e2e tests

**What's missing:**
- Switching between payment options (Insurance ↔ Self-pay)
- Secondary insurance flow
- Saved card selection vs new card entry
- Policy holder relationship variations

**Recommendation:** Component tests for payment option switching logic. The happy path (single payment method) is covered by the generated tests.

#### 3.2 Responsible Party Variations
**Status:** Partially covered

**What's covered:**
- Self as responsible party (default in new patient flow)
- Basic returning patient flow (may have non-self RP)

**What's missing:**
- Explicit testing of non-self responsible party form
- Policy holder relationship variations

**Recommendation:** Low priority - the form logic is the same, just different field visibility.

#### 3.3 Support Dialog
**Status:** Not covered

**What's missing:**
- Support button opens dialog
- Dialog content verification
- Contact information display

**Recommendation:** Component test - isolated UI feature, doesn't need full booking flow.

#### 3.4 Form Field Validation Messages
**Status:** Partially covered

**What's covered:**
- Validation check strategy (`checkValidation: true` in FillingStrategy)
- Form submission with invalid data triggers validation
- Correction flow after validation errors

**What's missing:**
- Verification of specific error message text
- All field-level validation rules

**Recommendation:** Unit/component tests for validation logic.

---

## Coverage by Legacy Test File

This section maps legacy tests to their coverage status in the new system:

### In-Person Tests (`tests/specs/`)

| Legacy Test File | Coverage Status |
|------------------|-----------------|
| `PaperworkExistingPatient.spec.ts` | ✅ Covered by `executeReturningPatientFlow()` |
| `PaperworkExisitingPatientSelf.spec.ts` | ✅ Covered by `executeReturningPatientFlow()` |
| `PaperworkReviewScreen.spec.ts` | ✅ Covered by `executeReviewPageVerification()` |
| `PastVisits.spec.ts` | ✅ Covered by `executePastVisitsFlow()` |
| `ReservationModification.spec.ts` | ✅ Covered by `executeModificationFlow()` + `executeCancellationFlow()` |
| `ReservationScreen.spec.ts` | ✅ Covered by booking confirmation in `executeBookingScenario()` |

### Telemed Tests (`tests/specs/`)

| Legacy Test File | Coverage Status |
|------------------|-----------------|
| `PaperworkTelemedExistingPatient.spec.ts` | ✅ Covered by `executeReturningPatientFlow()` |
| `PaperworkTelemedExistingPatientSelf.spec.ts` | ✅ Covered by `executeReturningPatientFlow()` |
| `PaperworkTelemedReviewScreen.spec.ts` | ✅ Covered by `executeReviewPageVerification()` |
| `WaitingRoom.spec.ts` | ✅ Covered by `executeWaitingRoomParticipantsFlow()` |
| `homepage.spec.ts` | ⚠️ Partially covered (navigation yes, support dialog no) |

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| **P1: Critical User Journeys** | ✅ Complete | New patient, returning patient, modification, cancellation |
| **P2: Important Features** | ✅ Complete | Past visits, waiting room, review page |
| **P3: Edge Cases** | ⚠️ Deferred | Better suited for component tests |
| **Infrastructure** | ✅ Complete | Group booking, resource isolation, CI reliability |

### What's Fully Covered
- All booking flow permutations (visit type × service mode × service category)
- New patient and returning patient flows
- Post-booking operations (modify, cancel, past visits)
- Virtual-specific features (waiting room participants)
- Review page functionality
- Multiple config types (synthetic + concrete instances)
- Group booking pattern (HealthcareService)

### What's Deferred to Component Tests
- Payment option switching logic
- Support dialog
- Specific validation error messages
- PDF/external link opening

### Legacy Test Deprecation Path
With P1 and P2 complete, the legacy tests in `tests/specs/` can be considered for deprecation. The new generated tests provide equivalent or better coverage with:
- Better parallelization (isolated resources)
- Config-awareness (adapts to downstream configs)
- Comprehensive permutation coverage (all valid combinations)
- Extended scenario distribution (maintains parallelization)

---

## Appendix: Extended Scenario Distribution

Extended scenarios are distributed across the test matrix to maintain parallelization:

| Extended Scenario | Attached To | Scenarios Per Config |
|-------------------|-------------|----------------------|
| Returning Patient | First in-person walk-in | 1 |
| Modification | First prebook | 1 |
| Cancellation | Second prebook | 1 |
| Past Visits | Third prebook OR second in-person walk-in | 1 |
| Waiting Room | First virtual walk-in | 1 |
| Review Page | Fourth prebook OR second virtual walk-in | 1 |

This distribution ensures:
- Each extended scenario runs once per config type
- No single test becomes a bottleneck
- Parallel execution is preserved
