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

### 2. Concrete Test Configs
**Location:** `apps/intake/tests/utils/booking-flow-concrete-smoke-configs/`

Instance-specific configurations that test real-world config combinations. Each concrete config is a folder containing:

```
instance-name/
├── index.ts                      # FillingStrategy, skip flag
├── booking/index.ts              # BOOKING_OVERRIDES
├── intake-paperwork/index.ts     # In-person paperwork config
├── intake-paperwork-virtual/index.ts  # Virtual paperwork config
├── locations/index.ts            # LOCATIONS_OVERRIDES
└── value-sets/index.ts           # VALUE_SETS_OVERRIDES
```

Concrete configs are **auto-discovered** at runtime - add a new folder and it's automatically included in the test matrix.

**Upstream vs Downstream:**
Concrete tests only run in the upstream ottehr repo. Set `RUN_CONCRETE_TESTS=true` in CI to enable them. Downstream instances skip concrete tests entirely - no scenarios are generated, no resources are created.

### 3. Config Helper Utilities
**Location:** `apps/intake/tests/utils/config/`

Derive test expectations from config:

**BookingConfigHelper.ts:**
```typescript
- getHomepageOptions(config) → enabled booking buttons
- getServiceCategories(config) → available service categories
- injectTestConfig(page, overrides) → inject config before navigation
```

**PaperworkConfigHelper.ts:**
```typescript
- injectIntakePaperworkConfig(page, config) → inject in-person config
- injectVirtualPaperworkConfig(page, config) → inject virtual config
- injectValueSets(page, valueSets) → inject dropdown options
```

**LocationsConfigHelper.ts:**
```typescript
- transformLocationsForInjection(config, createdLocations) → map config names to test locations
- injectLocationsConfig(page, locations) → inject location overrides
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
- findAndClickSuitableTimeSlot(page, minMinutes) → shared time selection logic
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
(synthetic scenarios) + (concrete config scenarios)
  = homepage_option × service_category per config type

Example:
- Synthetic: 4 homepage options × 3 service categories = 12 scenarios
- Concrete Instance 2: 4 homepage options × 3 service categories = 12 scenarios
- Total: 24+ scenarios (varies by concrete config count)
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
- ensureConcreteConfigLocations(configId, overrides) → locations per concrete config
- cleanup() → delete all test resources
```

**TestQuestionnaireManager.ts** - Deploys test questionnaires:
```typescript
- ensureTestQuestionnaire(configId, overrides, serviceMode) → deploy questionnaire with overrides
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
- shouldExtendWithReturningPatient(scenario, allScenarios) → first in-person walk-in per config
- shouldExtendWithModification(scenario, allScenarios) → first prebook per config
- shouldExtendWithCancellation(scenario, allScenarios) → second prebook per config
// ... etc
```

### 8. Paperwork Flow Helper
**Location:** `apps/intake/tests/utils/paperwork/PagedQuestionnaireFlowHelper.ts`

Dynamic questionnaire page filling:
```typescript
- getFirstVisiblePage() → first page based on enableWhen evaluation
- getNextVisiblePage(currentPageId) → next page after responses collected
- fillPageAndContinue(valueMap, pageLinkId) → fill fields and submit
- fillPageWithValidationCheck(valid, invalid, pageLinkId) → test validation errors
- verifyFieldsNotShown(fieldLinkIds) → assert hidden fields are hidden
```

## Test Organization

### Test Groups

Tests are organized into nested describe blocks for selective execution:

```typescript
test.describe('Complete booking flows', () => {
  // Shared beforeAll/afterAll for resource setup/cleanup

  test.describe('Synthetic (baseline)', () => {
    // Baseline config scenarios
  });

  test.describe('Concrete: Instance 2', () => {
    // Instance-specific scenarios
  });
});
```

**Run specific groups:**
```bash
npx playwright test --grep "Synthetic"           # Only baseline
npx playwright test --grep "Concrete: Instance"  # Only concrete configs
```

### E2E Test File
**Location:** `apps/intake/tests/e2e/booking-flows-generated.spec.ts`

**Structure:**
```typescript
// 1. Generate scenarios at module load
const scenarios = await generateBookingTestScenarios('baseline');
const concreteConfigs = await CONCRETE_TEST_CONFIGS;

// 2. Group scenarios by config type
const syntheticScenarios = scenarios.filter(s => !s.configName.startsWith('concrete:'));
const concreteScenarioGroups = new Map(/* grouped by config ID */);

// 3. Shared setup (beforeAll)
- Create test locations (walk-in, prebook in-person, prebook virtual, group)
- Create concrete config locations
- Deploy test questionnaires
- Configure Group booking for urgent-care prebook in-person

// 4. Generate tests per group
test.describe('Synthetic (baseline)', () => {
  for (const scenario of syntheticScenarios) {
    test(scenario.description, async ({ page }) => {
      // Execute flow + extended scenarios
    });
  }
});

// 5. Cleanup (afterAll)
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

// 3. Test questionnaire is deployed with config overrides
const canonical = await testQuestionnaireManager.ensureTestQuestionnaire(
  'baseline', {}, ServiceMode['in-person']
);
scenario.testQuestionnaireCanonical = canonical;

// 4. executeBookingScenario runs the flow
await executeBookingScenario(page, scenario, locationName);

// Steps executed:
// a. Inject config overrides via window.__TEST_BOOKING_CONFIG__
// b. Inject paperwork config via window.__TEST_INTAKE_PAPERWORK_CONFIG__
// c. Set up route interception to inject testQuestionnaireCanonical
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
// Inject before navigation - app reads on load
await page.addInitScript((config) => {
  window.__TEST_BOOKING_CONFIG__ = config;
}, overrides);
```

### 2. Worker-Isolated Resources
```typescript
// Each parallel worker gets unique resources
const workerUniqueId = `${suiteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const location = await createLocation({ name: `TestLocation-${workerUniqueId}` });
```

### 3. Route Interception for Test Data
```typescript
// Inject test questionnaire canonical into API requests
await page.route('**/create-appointment/execute', async (route, request) => {
  const postData = request.postDataJSON();
  await route.continue({
    postData: JSON.stringify({
      ...postData,
      testQuestionnaireCanonical: scenario.testQuestionnaireCanonical,
    }),
  });
});
```

### 4. Time Slot Selection with Buffer
```typescript
// Avoid "appointment in the past" flakes by selecting future slots
static async selectFirstAvailableTimeSlot(page: Page, minMinutesInFuture = 30) {
  const now = new Date();
  const minAcceptableTime = new Date(now.getTime() + minMinutesInFuture * 60 * 1000);
  // Find and click slot >= minAcceptableTime
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
packages/utils/lib/
├── ottehr-config/
│   ├── intake-paperwork/index.ts      # getIntakePaperworkConfig()
│   ├── intake-paperwork-virtual/      # getIntakePaperworkVirtualConfig()
│   └── booking/index.ts               # getBookingConfig()
└── ottehr-config-test-fixtures/
    ├── capability-configs.ts          # Intake capability configs
    ├── booking-capability-configs.ts  # Booking capability configs
    └── index.ts                       # Public exports

apps/intake/tests/
├── e2e/
│   ├── booking-flows-generated.spec.ts  # Main test file
│   └── README.md                        # Developer guide
├── utils/
│   ├── config/
│   │   ├── BookingConfigHelper.ts       # Booking config utilities
│   │   ├── PaperworkConfigHelper.ts     # Paperwork injection
│   │   └── LocationsConfigHelper.ts     # Location config utilities
│   ├── booking/
│   │   ├── BookingTestFactory.ts        # Scenario generator ⭐
│   │   ├── BookingFlowHelpers.ts        # Page interactions
│   │   ├── ExtendedScenarioHelpers.ts   # P1/P2 extended flows
│   │   ├── TestLocationManager.ts       # FHIR resource management
│   │   └── TestQuestionnaireManager.ts  # Questionnaire deployment
│   ├── paperwork/
│   │   ├── PagedQuestionnaireFlowHelper.ts  # Dynamic form filling
│   │   └── paperworkDataTemplates.ts        # Test data per page
│   └── booking-flow-concrete-smoke-configs/
│       ├── index.ts                     # Auto-discovery loader
│       ├── instance-1-overrides/        # First concrete config
│       └── instance-2-overrides/        # Second concrete config
├── CONFIG_AWARE_TESTING_ARCHITECTURE.md  # This document
└── E2E_COVERAGE_GAP_ANALYSIS.md          # Coverage tracking
```

## Benefits

### 1. **Automatic Adaptation**
- Downstream repos run same tests with their configs
- Tests skip if flow not enabled
- No manual test modification needed

### 2. **Comprehensive Coverage**
- Factory generates all valid permutations automatically
- Extended scenarios cover post-booking flows
- Concrete configs test real-world configurations

### 3. **Parallel Execution**
- Worker-isolated resources (locations, questionnaires)
- No shared state or race conditions
- 6 parallel workers in CI

### 4. **CI Reliability**
- Time slot selection avoids "past appointment" flakes
- 6-minute test timeout for extended flows
- Resource cleanup prevents pollution

### 5. **Developer Experience**
- Add concrete config folder → tests auto-generated
- Run specific groups with `--grep`
- Debug with UI mode or traces

## Adding New Tests

### To add a new concrete config:
1. Create folder under `booking-flow-concrete-smoke-configs/`
2. Add required files (index.ts, booking/, intake-paperwork/, etc.)
3. Set `skip = false` in index.ts
4. Tests automatically generated on next run

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

