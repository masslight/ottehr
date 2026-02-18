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

### 2. Config Factory Functions
**Location:** `packages/utils/lib/ottehr-config-test-fixtures/`

Create isolated config instances for testing:

```typescript
// Intake paperwork
createConfigForTest('hiddenFields') 
  → IntakePaperworkConfig with hidden field overrides

// Booking
createBookingConfigForTest('virtualOnly')
  → BookingConfig with only virtual options
```

**Key Feature:** Each call creates a fresh, isolated instance - no shared state, enabling parallel test execution.

### 3. Config Helper Utilities
**Location:** `apps/intake/tests/utils/config/`

Derive test expectations from config:

**ConfigHelper.ts** (Intake):
```typescript
- getPageTitle(pageKey, config) → page title from config
- getVisibleFields(section) → fields not in hiddenFields
- getRequiredFields(section) → required field list
- isFieldHidden(fieldKey, section) → visibility check
```

**BookingConfigHelper.ts** (Booking):
```typescript
- getEnabledServiceModes(config) → ['in-person', 'virtual']
- getHomepageOptions(config) → enabled booking options
- getTestableFlows(config) → ['in-person-walk-in', 'virtual-prebook', ...]
- getVisiblePatientFields(config) → visible form fields
- isServiceModeEnabled(mode, config) → availability check
```

### 4. Page Interaction Helpers
**Location:** `apps/intake/tests/utils/booking/`

**BookingFlowHelpers.ts** - Config-aware page interactions:
```typescript
- fillPatientInfo(page, config, data) 
  → fills only visible fields from config
  
- selectServiceCategoryIfNeeded(page, config, category)
  → only selects if multiple categories available
  
- completePatientInfoStep(page, config, data)
  → fills form and continues based on config
```

### 5. Test Factory (The Key Innovation)
**Location:** `apps/intake/tests/utils/booking/BookingTestFactory.ts`

Generates test permutations automatically:

```typescript
generateBookingTestScenarios('baseline')
  → [
      { homepageOption: 'start-in-person-visit', 
        serviceCategory: 'urgent-care', 
        visitType: 'walk-in', 
        serviceMode: 'in-person' },
      
      { homepageOption: 'start-in-person-visit', 
        serviceCategory: 'occupational-medicine', 
        visitType: 'walk-in', 
        serviceMode: 'in-person' },
      
      // ... all valid permutations
    ]
```

**Scenario Structure:**
```
homepage_option × service_category × location = test scenarios

Example for baseline config:
- 4 homepage options (start/schedule × in-person/virtual)
× 3 service categories (urgent-care, occ-med, workers-comp)
= 12 complete flow scenarios
```

**Key Functions:**
```typescript
executeBookingScenario(page, scenario, locationName)
  → Runs complete flow: homepage → category → patient info → location → time slot → paperwork → confirm
```

## Test Organization

### Unit Tests
**Location:** `apps/intake/tests/unit/`

- **config-helper.test.ts** - Tests ConfigHelper utilities (✅ ALL PASSING)
- **booking-config-helper.test.ts** - Tests BookingConfigHelper utilities (✅ ALL PASSING)

Validate that helpers correctly derive expectations from config without browser automation.

### E2E Tests
**Location:** `apps/intake/tests/e2e/`

- **booking-flows-generated.spec.ts** - Factory-generated permutation tests

**Test Structure:**
```typescript
Complete Booking Flows (dynamically generated)
- One comprehensive test per scenario permutation
- Covers full flow: homepage → service category → patient info → location → time slot → paperwork → confirmation
- All tests run in parallel with isolated test resources
- Scenarios include:
  - Capability configs: baseline flows (walk-in/prebook × in-person/virtual)
  - Concrete configs: instance-specific paperwork variations (occ-med, workers-comp)
```

## How It Works: Flow Example

**Scenario:** Test virtual walk-in urgent-care flow

```typescript
// 1. Config defines capabilities
const config = createBookingConfigForTest('baseline');

// 2. Factory generates scenarios from config
const scenarios = generateBookingTestScenarios('baseline');
// → includes { homepageOption: 'start-virtual-visit', 
//              serviceCategory: 'urgent-care',
//              visitType: 'walk-in', serviceMode: 'virtual' }

// 3. Test loop generates a test for this scenario
test('start-virtual-visit → urgent-care - complete flow', async ({ page }) => {
  const scenario = scenarios.find(/* this scenario */);
  
  // 4. Execute flow using helpers that read config
  await executeBookingScenario(page, scenario, config);
  
  // Steps executed:
  // - startBookingFlow() → clicks start-virtual-visit
  // - selectServiceCategoryIfNeeded() → selects urgent-care if multiple options
  // - completePatientInfoStep() → fills only visible fields from config
  // - selectFirstAvailableLocation() → picks a location
  // - confirmBooking() → confirms
  
  // 5. Verify success
  await expect(page.getByTestId('booking-confirmation')).toBeVisible();
});
```

## Benefits

### 1. **Automatic Adaptation**
- Downstream repos run same tests with their configs
- Tests skip if flow not enabled (e.g., virtualOnly skips in-person tests)
- No manual test modification needed

### 2. **Comprehensive Coverage**
- Factory generates all valid permutations automatically
- No manual test duplication
- Easy to see what's tested: log generated scenarios

### 3. **Parallel Execution**
- All tests use isolated config instances
- No shared state or race conditions
- Fast test execution

### 4. **Maintainability**
- Single source of truth: config
- Change config → tests adapt automatically
- Clear separation: config vs. test logic

### 5. **Encapsulation**
- Tests don't access private config defaults
- Use only public config API
- Proper abstraction boundaries

## Adding New Tests

### To add a new capability config:
1. Add to `booking-capability-configs.ts`:
   ```typescript
   newPattern: {
     name: 'new-pattern',
     description: 'Description',
     overrides: { /* overrides */ }
   }
   ```

2. Tests automatically generated for new pattern:
   ```typescript
   generateBookingTestScenarios('newPattern')
   ```

### To add a new test step:
1. Add step logic to `executeBookingScenario` in `BookingTestFactory.ts`
2. Update the scenario flow to include the new step
3. If needed, add helper functions to `BookingFlowHelpers.ts`

### To add a new page helper:
1. Add to `BookingFlowHelpers.ts`:
   ```typescript
   static async newInteraction(page: Page, config: BookingConfig) {
     // Config-aware interaction
   }
   ```

2. Use in test factory:
   ```typescript
   await BookingFlowHelpers.newInteraction(page, config);
   ```

## File Structure

```
packages/utils/lib/
├── ottehr-config/
│   ├── intake-paperwork/index.ts      # Added: getIntakePaperworkConfig()
│   └── booking/index.ts               # Added: getBookingConfig()
└── ottehr-config-test-fixtures/
    ├── capability-configs.ts          # Intake capability configs
    ├── booking-capability-configs.ts  # Booking capability configs
    ├── helpers.ts                     # createConfigForTest()
    ├── booking-helpers.ts             # createBookingConfigForTest()
    └── index.ts                       # Public exports

apps/intake/tests/
├── unit/
│   ├── config-helper.test.ts          # ConfigHelper unit tests ✅
│   └── booking-config-helper.test.ts  # BookingConfigHelper unit tests ✅
├── utils/
│   ├── config/
│   │   ├── ConfigHelper.ts            # Intake paperwork helpers
│   │   └── BookingConfigHelper.ts     # Booking config helpers
│   └── booking/
│       ├── BookingFlowHelpers.ts      # Page interaction helpers
│       └── BookingTestFactory.ts      # Test scenario generator ⭐
└── e2e/
    └── booking-flows-generated.spec.ts # Factory-generated e2e tests
```

## Key Design Patterns

### 1. Direct Config Injection
```typescript
// NOT using environment variables (race conditions)
// NOT using global singletons (shared state)

// YES: Direct injection with isolated instances
const config = getIntakePaperworkConfig(testOverrides);
```

### 2. Pure Functions
```typescript
// All helpers are pure functions
static getPageTitle(pageKey: string, config: IntakePaperworkConfig): string {
  // No side effects, no shared state
  return config.FormFields[pageKey].title;
}
```

### 3. Factory Pattern
```typescript
// Generate test matrix from config
const scenarios = generateBookingTestScenarios(configName);

// Create tests for each scenario
for (const scenario of scenarios) {
  test(scenario.description, async ({ page }) => {
    await executeBookingScenario(page, scenario, config);
  });
}
```

### 4. Capability Abstraction
```typescript
// Tests abstract capabilities, not implementations
CAPABILITY_TEST_CONFIGS = {
  hiddenFields: { /* how to hide fields */ },
  customCopy: { /* how to customize text */ }
}
// NOT: clientA, clientB configs (private implementation)
```

## Next Steps

### Completed
1. ✅ Add navigation logic to existing test stubs
2. ✅ Verify all generated tests pass with actual app
3. ✅ Add paperwork step to flow execution
4. ✅ Add concrete config support (instance-specific paperwork variations)
5. ✅ Test questionnaire deployment for concrete configs
6. ✅ Parallel test execution with isolated test resources

### Future Enhancements
1. Connect test flow output to EHR-side tests to validate the handoff between intake and EHR

## Evolution Log

- **Phase 1:** Created capability configs and helpers (intake paperwork)
- **Phase 2:** Extended to booking flows
- **Phase 3:** Developed test factory pattern for permutation generation
- **Phase 4:** Consolidated into single e2e test file using factory ✅ Current
