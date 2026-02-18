# Intake E2E Tests

This document provides an overview of the intake end-to-end testing architecture and practical guidance for developers working with these tests.

## Quick Start

```bash
# Run all e2e tests (synthetic only by default)
npx playwright test --project=e2e

# Run only synthetic (baseline) tests
npx playwright test --project=e2e --grep "Synthetic"

# Run with concrete config tests (upstream ottehr repo only)
RUN_CONCRETE_TESTS=true npx playwright test --project=e2e

# Run only a specific concrete config
RUN_CONCRETE_TESTS=true npx playwright test --project=e2e --grep "Concrete: Instance 2"

# Run with UI mode for debugging
npx playwright test --project=e2e --ui
```

### Upstream vs Downstream Repos

| Repo | Concrete Tests | Environment Variable |
|------|----------------|---------------------|
| **ottehr** (upstream) | ✅ Enabled | `RUN_CONCRETE_TESTS=true` in CI |
| **Downstream instances** | ❌ Disabled | Not set (default) |

Concrete config tests represent instance-specific configurations and are only relevant in the upstream ottehr repo. Downstream repos inherit synthetic tests which validate the baseline booking flows work with their config overrides.

## Architecture Overview

The e2e tests use a **config-driven test generation** approach. Instead of writing individual tests for each flow, we:

1. Define **configurations** (booking options, paperwork fields, locations)
2. A **test factory** generates test scenarios from these configurations
3. Tests **automatically adapt** when configurations change

### Test Organization

```
tests/e2e/
└── booking-flows-generated.spec.ts    # Main test file (auto-generated scenarios)

tests/utils/
├── booking/
│   ├── BookingTestFactory.ts          # Generates test scenarios from config
│   ├── BookingFlowHelpers.ts          # Page interaction helpers
│   ├── ExtendedScenarioHelpers.ts     # Post-booking flows (modify, cancel, etc.)
│   ├── TestLocationManager.ts         # Creates isolated test locations
│   └── TestQuestionnaireManager.ts    # Deploys test questionnaires
├── config/
│   ├── BookingConfigHelper.ts         # Extracts booking options from config
│   ├── PaperworkConfigHelper.ts       # Injects paperwork config overrides
│   └── LocationsConfigHelper.ts       # Manages location config injection
├── paperwork/
│   └── PagedQuestionnaireFlowHelper.ts # Fills paperwork pages dynamically
└── booking-flow-concrete-smoke-configs/
    ├── index.ts                       # Discovers and loads concrete configs
    ├── instance-1-overrides/          # First concrete instance
    └── instance-2-overrides/          # Second concrete instance
```

### Test Groups

Tests are organized into groups for selective execution:

| Group | Description | Run Command |
|-------|-------------|-------------|
| **Synthetic (baseline)** | Tests baseline config with all booking flows | `--grep "Synthetic"` |
| **Concrete: \<name\>** | Tests instance-specific config overrides | `--grep "Concrete: Instance 2"` |

Each group runs the full booking flow matrix:
- **Visit types:** Walk-in, Prebook
- **Service modes:** In-person, Virtual
- **Service categories:** Urgent Care, Occupational Medicine, Workers Comp

### What Each Test Covers

Each generated test executes a complete user journey:

```
Homepage → Service Category → Patient Info → Location → Time Slot → Paperwork → Completion
```

Plus extended coverage distributed across scenarios:
- **Returning patient flow** (patient selection, prefilled data)
- **Reservation modification** (reschedule to new time)
- **Reservation cancellation** (cancel + book again)
- **Past visits page** (view appointment history)
- **Waiting room management** (virtual only - invite/cancel participants)
- **Review page verification** (edit buttons, chip status)

## Using Concrete Configs for Development

Concrete configs allow you to test **instance-specific overrides** as part of your development workflow. This is useful when:

- Adding new config options that affect the booking/paperwork flow
- Testing customer-specific configurations before deployment
- Validating that config changes don't break existing flows

### Concrete Config Structure

Each concrete config is a folder under `tests/utils/booking-flow-concrete-smoke-configs/`:

```
instance-2-overrides/
├── index.ts                      # Filling strategy and skip flag
├── booking/
│   └── index.ts                  # BOOKING_OVERRIDES
├── intake-paperwork/
│   └── index.ts                  # INTAKE_PAPERWORK_CONFIG (in-person)
├── intake-paperwork-virtual/
│   └── index.ts                  # INTAKE_PAPERWORK_CONFIG (virtual)
├── locations/
│   └── index.ts                  # LOCATIONS_OVERRIDES
└── value-sets/
    └── index.ts                  # VALUE_SETS_OVERRIDES
```

### Creating a New Concrete Config

1. **Copy an existing config folder:**
   ```bash
   cp -r tests/utils/booking-flow-concrete-smoke-configs/instance-2-overrides \
         tests/utils/booking-flow-concrete-smoke-configs/my-feature-overrides
   ```

2. **Update the index.ts:**
   ```typescript
   // my-feature-overrides/index.ts
   import { FillingStrategy } from 'tests/utils/booking/BookingTestFactory';

   export const fillingStrategy: FillingStrategy = {
     checkValidation: true,
     fillAllFields: true,
     // Optional: verify specific fields are hidden
     verifyFieldsNotShown: [
       { pageLinkId: 'patient-details-page', fieldLinkId: 'patient-pronouns' },
     ],
   };

   // Set to true to skip this config during test runs
   export const skip = false;
   ```

3. **Configure your overrides:**

   **Booking overrides** (`booking/index.ts`):
   ```typescript
   export const BOOKING_OVERRIDES = {
     // Homepage options to show
     homepageOptions: [
       { id: 'start-in-person-visit', label: 'Walk-in visit' },
       { id: 'schedule-in-person-visit', label: 'Book appointment' },
     ],
     // Service categories available
     serviceCategories: [
       { code: 'urgent-care', display: 'Urgent Care' },
     ],
   };
   ```

   **Paperwork overrides** (`intake-paperwork/index.ts`):
   ```typescript
   export const INTAKE_PAPERWORK_CONFIG = {
     FormFields: {
       patientDetails: {
         hiddenFields: ['patient-pronouns', 'patient-point-of-discovery'],
       },
       pharmacy: {
         // Only show for urgent-care
         triggers: [
           {
             targetQuestionLinkId: 'contact-information-page.appointment-service-category',
             effect: ['enable'],
             operator: '=',
             answerString: 'urgent-care',
           },
         ],
       },
     },
   };
   ```

   **Locations** (`locations/index.ts`):
   ```typescript
   export const LOCATIONS_OVERRIDES = {
     inPersonLocations: [
       { name: 'Downtown Clinic' },
       { name: 'Suburb Office' },
     ],
     telemedLocations: [
       { name: 'Telemed Downtown' },
     ],
   };
   ```

4. **Run your tests:**
   ```bash
   # Run only your new config
   npx playwright test --project=e2e --grep "Concrete: My Feature"
   ```

### Skipping a Concrete Config

To temporarily disable a concrete config (e.g., work in progress):

```typescript
// index.ts
export const skip = true;  // Tests will skip this config
```

### Verifying Hidden Fields

If your config hides certain fields, you can verify they're actually hidden:

```typescript
// index.ts
export const fillingStrategy: FillingStrategy = {
  checkValidation: true,
  fillAllFields: true,
  verifyFieldsNotShown: [
    { pageLinkId: 'patient-details-page', fieldLinkId: 'patient-pronouns' },
    { pageLinkId: 'payment-option-page', fieldLinkId: 'self-pay-alert-text' },
  ],
};
```

The test will fail if any of these fields are visible when they should be hidden.

## Test Resource Isolation

Tests create isolated resources to enable parallel execution:

- **Locations:** Each test worker creates unique test locations with 24/7 schedules
- **Questionnaires:** Dedicated questionnaires deployed per config to avoid conflicts
- **Cleanup:** All test resources are automatically deleted after tests complete

This means:
- Tests can run in parallel without interference
- Multiple CI runs don't conflict with each other
- Local and CI runs use separate resources

## Debugging Tips

### View test traces
```bash
npx playwright show-trace test-results/path-to-trace.zip
```

### Run in headed mode
```bash
npx playwright test --project=e2e --headed
```

### Debug a specific test
```bash
npx playwright test --project=e2e --grep "urgent-care" --debug
```

### Check generated scenarios
Add logging to see what scenarios are generated:
```typescript
// In booking-flows-generated.spec.ts
console.log('Generated scenarios:', scenarios.map(s => s.description));
```

## Configuration Reference

### FillingStrategy

| Property | Type | Description |
|----------|------|-------------|
| `checkValidation` | boolean | Submit with invalid data first to verify validation |
| `fillAllFields` | boolean | Fill all visible fields (vs. only required) |
| `verifyFieldsNotShown` | array | Fields that should NOT be visible |

### ConcreteTestConfig

| Property | Type | Description |
|----------|------|-------------|
| `bookingOverrides` | object | Homepage options, service categories |
| `paperworkConfigInPerson` | object | In-person paperwork field config |
| `paperworkConfigVirtual` | object | Virtual paperwork field config |
| `locationsOverrides` | object | Location names and phone numbers |
| `valueSetsOverrides` | object | Dropdown options, reason codes |

## Troubleshooting

### Tests timing out
- Default test timeout is 6 minutes for e2e tests
- If tests consistently timeout, check for slow API responses or stuck UI states
- Use `--debug` mode to step through and identify the bottleneck

### "No time slots available"
- Test locations are created with 24/7 schedules
- If this error appears, check that `TestLocationManager.ensureAlwaysOpenLocation()` succeeded in `beforeAll`

### Config not being applied
- Configs are injected via `window.__TEST_*_CONFIG__` before navigation
- Ensure your config is exported with the correct name (`BOOKING_OVERRIDES`, `INTAKE_PAPERWORK_CONFIG`, etc.)
- Check browser console for config injection logs

### Parallel test conflicts
- Each worker gets a unique ID for resource isolation
- If you see conflicts, ensure you're not sharing mutable state between tests

## Further Reading

- [Config-Aware Testing Architecture](../CONFIG_AWARE_TESTING_ARCHITECTURE.md) - Deep dive into the architecture
- [E2E Coverage Gap Analysis](../E2E_COVERAGE_GAP_ANALYSIS.md) - Coverage status and roadmap
