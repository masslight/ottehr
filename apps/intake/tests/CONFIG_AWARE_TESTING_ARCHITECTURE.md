# Config-Aware E2E Testing Architecture

## Overview

This architecture enables e2e tests to automatically adapt to configuration changes, allowing downstream repos to run the same test suite with their customized configs. Tests derive their behavior from configuration rather than hardcoded values.

## Core Problem Solved

**Before:** Tests hardcoded to upstream config fail in downstream repos despite the app working correctly.

**After:** Tests read config to determine:
- Which booking flows are available
- Which form fields should be visible
- Which pages should appear in the flow
- What validation rules apply

## How Instance-Specific Testing Works

The test framework uses the `ottehr-config-overrides` folder to customize test behavior:

1. **Upstream repo:** `ottehr-config-overrides` contains empty stub objects (`{}`)
2. **Downstream deployment:** A private CI repo clones ottehr, then overwrites `ottehr-config-overrides` with instance-specific values
3. **Tests run:** The same test suite runs against the instance-specific configuration

This means:
- Upstream tests run against the baseline default config
- Downstream tests automatically adapt to instance-specific configurations
- No need to maintain separate test configurations per instance

## Architecture Layers

### 1. Capability Test Configs
**Location:** `packages/utils/lib/ottehr-config-test-fixtures/`

Defines abstract configuration patterns that the system must support, not specific client implementations.

**Intake Paperwork Configs** (`capability-configs.ts`):
```typescript
- baseline: Default configuration
- hiddenFields: Fields hidden via hiddenFields array
- customCopy: Custom page titles and labels
```

**Booking Configs** (`booking-capability-configs.ts`):
```typescript
- baseline: All flows enabled
- inPersonOnly: Only in-person visits
- virtualOnly: Only virtual visits
- prebookOnly: Only scheduled appointments
- walkInOnly: Only walk-in visits
- urgentCareOnly: Single service category
- hiddenPatientFields: Some patient fields hidden
```

### 2. Instance-Specific Overrides
**Location:** `packages/utils/ottehr-config-overrides/`

Contains instance-specific configuration overrides. In the upstream repo, these are empty stubs. For downstream testing, a private CI repo overwrites these files with actual instance configurations.

Key exports:
```typescript
- INTAKE_PAPERWORK_OVERRIDES: In-person paperwork config
- INTAKE_PAPERWORK_VIRTUAL_OVERRIDES: Virtual paperwork config
- BOOKING_CONFIG: Booking flow config
- LOCATIONS_CONFIG: Location settings
- VALUE_SETS_OVERRIDES: Dropdown/select options
```

### 3. Config Injection
**Location:** `apps/intake/tests/utils/config/injectTestConfig.ts`

Simple utility for injecting test configs before page navigation:

```typescript
import { CONFIG_INJECTION_KEYS } from 'utils';

// Inject booking config (questionnaire selection is handled via Slot extension)
injectTestConfig(page, CONFIG_INJECTION_KEYS.BOOKING, config)
```

### 4. Page Interaction Helpers
**Location:** `apps/intake/tests/utils/booking/`

**BookingFlowHelpers.ts** - Config-aware page interactions:
```typescript
- startBookingFlow(page, optionLabel) → navigate and click booking option
- selectServiceCategoryIfNeeded(page, config, category) → select if multiple available
- completePatientInfoStep(page, config, data, fillingStrategy) → fill patient form
- selectFirstAvailableLocation(page, locationName, serviceMode) → pick location
- selectFirstAvailableTimeSlot(page, minMinutesInFuture) → pick time slot with buffer
- confirmBooking(page, visitType, serviceMode) → confirm and capture response
- findAndClickSuitableTimeSlot(page, minMinutes, options?) → shared time selection logic
  // options.skipFirstN: Skip first N slots (for modification flows to avoid current slot)
```

### 5. Test Factory
**Location:** `apps/intake/tests/utils/booking/BookingTestFactory.ts`

Generates test permutations automatically:

```typescript
generateBookingTestScenarios('baseline')
  → [
      {
        configName: 'baseline',
        homepageOptionId: 'start-in-person-visit',
        homepageOptionLabel: 'Start a walk-in visit',
        serviceCategory: 'urgent-care',
        visitType: 'walk-in',
        serviceMode: 'in-person',
        bookableEntityType: 'Location',  // or 'Group' for HealthcareService
        resolvedConfig: BookingConfig,
        resolvedPaperworkConfig: PaperworkConfig,
        fillingStrategy: { checkValidation: true, fillAllFields: true }
      },
      // ... all valid permutations
    ]
```

**Scenario Structure:**
```
homepage_option × service_category = all valid permutations

Example:
- 4 homepage options × 3 service categories = 12 scenarios
```

**Key Functions:**
```typescript
executeBookingScenario(page, scenario, locationName)
  → Runs complete flow: homepage → category → patient info → location → time slot → paperwork → confirm
```

### 6. Test Resource Management
**Location:** `apps/intake/tests/utils/booking/`

**TestLocationManager.ts** - Creates isolated FHIR resources:
```typescript
- ensureAlwaysOpenLocation() → 24/7 walk-in location
- ensurePrebookInPersonLocationWithSlots() → prebook location with slots
- ensurePrebookVirtualLocationWithSlots() → virtual location with slots
- ensurePrebookInPersonGroupWithSlots() → HealthcareService group booking
- cleanup() → delete all test resources
```

**TestQuestionnaireManager.ts** - Deploys test questionnaires:
```typescript
- ensureTestQuestionnaire(configId, overrides, serviceMode, consentForms?) → deploy questionnaire with overrides
  // consentForms: Optional resolved consent forms for instance-specific consent form items
- cleanup() → delete test questionnaires
```

**Key Feature:** Each test worker gets a unique ID (`workerUniqueId`) ensuring complete resource isolation for parallel execution.

### 7. Extended Scenario Helpers
**Location:** `apps/intake/tests/utils/booking/ExtendedScenarioHelpers.ts`

Post-booking flows distributed across scenarios for comprehensive coverage:

**P1 - Critical User Journeys:**
```typescript
- executeReturningPatientFlow() → patient selection, prefilled data
- executeModificationFlow() → reschedule appointment
- executeCancellationFlow() → cancel and book again
```

**P2 - Important Features:**
```typescript
- executeWaitingRoomParticipantsFlow() → invite/cancel participants (virtual)
- executePastVisitsFlow() → view appointment history
- executeReviewPageVerification() → edit buttons, chip status
```

**Distribution Logic:**
```typescript
- shouldExtendWithReturningPatient(scenario, allScenarios) → first in-person walk-in
- shouldExtendWithModification(scenario, allScenarios) → first prebook
- shouldExtendWithCancellation(scenario, allScenarios) → second prebook
// ... etc
```

### 8. Paperwork Flow Helper
**Location:** `apps/intake/tests/utils/paperwork/PagedQuestionnaireFlowHelper.ts`

Dynamic questionnaire page filling:
```typescript
- getFirstVisiblePage() → first page based on enableWhen evaluation
- getNextVisiblePage(currentPageId) → next page after responses collected
- fillPageAndContinue(valueMap, pageLinkId) → fill fields and submit
  // Auto-checks all consent form checkboxes when pageLinkId is 'consent-forms-page'
- fillPageWithValidationCheck(valid, invalid, pageLinkId) → test validation errors
- verifyFieldsNotShown(fieldLinkIds) → assert hidden fields are hidden
- checkAllConsentCheckboxes() → check all consent checkboxes on current page
```

## E2E Test File
**Location:** `apps/intake/tests/e2e/booking-flows-generated.spec.ts`

**Structure:**
```typescript
// 1. Generate scenarios at module load
const scenarios = await generateBookingTestScenarios('baseline');

// 2. Shared setup (beforeAll)
- Create test locations (walk-in, prebook in-person, prebook virtual, group)
- Deploy test questionnaires with instance-specific overrides
- Configure Group booking for urgent-care prebook in-person

// 3. Generate tests for each scenario
for (const scenario of scenarios) {
  test(scenario.description, async ({ page }) => {
    // Execute flow + extended scenarios
  });
}

// 4. Cleanup (afterAll)
- Delete test locations and schedules
- Delete test questionnaires
```

## How It Works: Complete Flow

**Scenario:** Test in-person prebook urgent-care with Group booking

```typescript
// 1. beforeAll creates resources
const group = await testLocationManager.ensurePrebookInPersonGroupWithSlots();
// Creates: HealthcareService + Location + Practitioner + PractitionerRole + 2 Schedules

// 2. Scenario is configured to use Group booking
scenario.bookableEntityType = 'Group';
scenario.groupBookingSlug = group.slug;

// 3. Test questionnaire is deployed with instance-specific overrides
const canonical = await testQuestionnaireManager.ensureTestQuestionnaire(
  'baseline', INTAKE_PAPERWORK_OVERRIDES, ServiceMode['in-person']
);
scenario.testQuestionnaireCanonical = canonical;

// 4. executeBookingScenario runs the flow
await executeBookingScenario(page, scenario, locationName);

// Steps executed:
// a. Inject config overrides via window.__TEST_BOOKING_CONFIG__
// b. Inject paperwork config via window.__TEST_INTAKE_PAPERWORK_CONFIG__
// c. Set up route interception to inject questionnaireCanonical into create-slot
// d. Navigate to /home and click booking button
// e. Select service category if multiple
// f. For Group booking: navigate to /prebook/in-person?bookingOn={slug}&scheduleType=group
// g. Select time slot (at least 30 min in future to avoid timing flakes)
// h. Fill patient info form
// i. Confirm booking and capture appointment response
// j. Complete paperwork pages dynamically
// k. Verify completion page

// 5. Extended scenario runs (if this scenario is selected)
if (shouldExtendWithModification(scenario, scenarios)) {
  await executeModificationFlow(page, appointmentResponse);
}
```

## Key Design Patterns

### 1. Config Injection via Window Globals
```typescript
import { CONFIG_INJECTION_KEYS } from 'utils';
import { injectTestConfig } from '../config/injectTestConfig';

// Inject booking config before navigation - app reads on load
// Questionnaire selection is handled via Slot extension (see pattern #3)
await injectTestConfig(page, CONFIG_INJECTION_KEYS.BOOKING, overrides);
```

### 2. Worker-Isolated Resources
```typescript
// Each parallel worker gets unique resources
const workerUniqueId = `${suiteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const location = await createLocation({ name: `TestLocation-${workerUniqueId}` });
```

### 3. Route Interception for Test Data
```typescript
// Inject questionnaire canonical into create-slot requests
// The create-appointment endpoint reads the canonical from the Slot extension
await page.route('**/create-slot/execute', async (route, request) => {
  const postData = request.postDataJSON();
  await route.continue({
    postData: JSON.stringify({
      ...postData,
      questionnaireCanonical: scenario.testQuestionnaireCanonical,
    }),
  });
});
```

### 4. Time Slot Selection with Buffer
```typescript
// Avoid "appointment in the past" flakes by selecting future slots
static async findAndClickSuitableTimeSlot(
  page: Page,
  minMinutesInFuture = 30,
  options?: { skipFirstN?: number }  // Skip first N slots (useful for modification flows)
) {
  const now = new Date();
  const minAcceptableTime = new Date(now.getTime() + minMinutesInFuture * 60 * 1000);
  // Find and click slot >= minAcceptableTime, skipping first N if specified
  // Handles timezone mismatches with fallback to slots at 2/3 through the list
}
```

### 5. Extended Scenario Distribution
```typescript
// Distribute extended coverage across scenarios to maintain parallelization
// Instead of: one long test with all extensions
// We have: many parallel tests, each with one extension
if (shouldExtendWithModification(scenario, scenarios)) { /* only first prebook */ }
if (shouldExtendWithCancellation(scenario, scenarios)) { /* only second prebook */ }
```

## File Structure

```
packages/utils/
├── lib/
│   ├── ottehr-config/
│   │   ├── intake-paperwork/index.ts      # getIntakePaperworkConfig()
│   │   ├── intake-paperwork-virtual/      # getIntakePaperworkVirtualConfig()
│   │   └── booking/index.ts               # getBookingConfig()
│   └── ottehr-config-test-fixtures/
│       ├── capability-configs.ts          # Intake capability configs
│       ├── booking-capability-configs.ts  # Booking capability configs
│       └── index.ts                       # Public exports
└── ottehr-config-overrides/
    ├── intake-paperwork/index.ts          # Instance-specific in-person overrides
    ├── intake-paperwork-virtual/index.ts  # Instance-specific virtual overrides
    └── ...                                # Other instance-specific configs

apps/intake/tests/
├── e2e/
│   ├── booking-flows-generated.spec.ts    # Main test file
│   └── README.md                          # Developer guide
├── utils/
│   ├── config/
│   │   └── injectTestConfig.ts            # Config injection utilities
│   ├── booking/
│   │   ├── BookingTestFactory.ts          # Scenario generator ⭐
│   │   ├── BookingFlowHelpers.ts          # Page interactions
│   │   ├── ExtendedScenarioHelpers.ts     # P1/P2 extended flows
│   │   ├── TestLocationManager.ts         # FHIR resource management
│   │   └── TestQuestionnaireManager.ts    # Questionnaire deployment
│   └── paperwork/
│       ├── PagedQuestionnaireFlowHelper.ts  # Dynamic form filling
│       └── paperworkDataTemplates.ts        # Test data per page
├── CONFIG_AWARE_TESTING_ARCHITECTURE.md   # This document
└── E2E_COVERAGE_GAP_ANALYSIS.md           # Coverage tracking
```

## Benefits

### 1. **Automatic Adaptation**
- Downstream repos run same tests with their configs
- Tests skip if flow not enabled
- No manual test modification needed

### 2. **Comprehensive Coverage**
- Factory generates all valid permutations automatically
- Extended scenarios cover post-booking flows

### 3. **Parallel Execution**
- Worker-isolated resources (locations, questionnaires)
- No shared state or race conditions
- 6 parallel workers in CI

### 4. **CI Reliability**
- Time slot selection avoids "past appointment" flakes
- 6-minute test timeout for extended flows
- Resource cleanup prevents pollution

### 5. **Simple Instance Testing**
- Overwrite `ottehr-config-overrides` with instance-specific values
- Run the same test suite
- No code changes needed

## Adding New Tests

### To add a new extended scenario:
1. Add execution function to `ExtendedScenarioHelpers.ts`
2. Add `shouldExtendWith*` distribution function
3. Call from test loop in `booking-flows-generated.spec.ts`

### To add a new booking flow step:
1. Add helper to `BookingFlowHelpers.ts`
2. Update `executeBookingScenario` in `BookingTestFactory.ts`
3. Update scenario interface if new data needed

## Future Enhancements
1. Connect test flow output to EHR-side tests to validate intake → EHR handoff
2. Visual regression testing for key screens
