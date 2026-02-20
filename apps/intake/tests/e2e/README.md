# Intake E2E Tests

This document provides an overview of the intake end-to-end testing architecture and practical guidance for developers working with these tests.

## Quick Start

### Local Development

Run all e2e tests locally with Playwright UI mode:

```bash
# From the repo root - starts servers and opens Playwright UI
npm run intake:e2e:local:ui
```

This starts local servers, runs login, then opens Playwright's interactive UI. Use the UI to select which tests to run.

### Other Commands

```bash
# Run tests headlessly (no UI)
npm run intake:e2e:local

# Run against other environments
npm run intake:e2e:demo:ui
npm run intake:e2e:staging:ui

# From apps/intake directory (skips server startup)
npm run e2e:specs        # Run tests headlessly
npm run e2e:specs:ui     # Run tests in Playwright UI
```

## Architecture Overview

The e2e tests use a **config-driven test generation** approach. Instead of writing individual tests for each flow, we:

1. Define **configurations** (booking options, paperwork fields, locations)
2. A **test factory** generates test scenarios from these configurations
3. Tests **automatically adapt** when configurations change

### Instance-Specific Testing

The test framework uses the `ottehr-config-overrides` folder to customize test behavior:

1. **Upstream repo:** `ottehr-config-overrides` contains empty stub objects (`{}`)
2. **Downstream deployment:** A private CI repo clones ottehr, then overwrites `ottehr-config-overrides` with instance-specific values
3. **Tests run:** The same test suite runs against the instance-specific configuration

This means:
- Upstream tests run against the baseline default config
- Downstream tests automatically adapt to instance-specific configurations
- No need to maintain separate test configurations per instance

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
│   └── injectTestConfig.ts            # Config injection utilities
└── paperwork/
    └── PagedQuestionnaireFlowHelper.ts # Fills paperwork pages dynamically
```

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

### Test Matrix

Tests cover the full booking flow matrix:
- **Visit types:** Walk-in, Prebook
- **Service modes:** In-person, Virtual
- **Service categories:** Urgent Care, Occupational Medicine, Workers Comp

## Test Resource Isolation

Tests create isolated resources to enable parallel execution:

- **Locations:** Each test worker creates unique test locations with 24/7 schedules
- **Questionnaires:** Dedicated questionnaires deployed per config to avoid conflicts
- **Cleanup:** All test resources are automatically deleted after tests complete

This means:
- Tests can run in parallel without interference
- Multiple CI runs don't conflict with each other
- Local and CI runs use separate resources

## Config Injection

Tests inject booking configuration overrides before page navigation using window globals.
Questionnaire selection is handled via the Slot extension (injected into create-slot requests).

```typescript
import { CONFIG_INJECTION_KEYS } from 'utils';
import { injectTestConfig } from '../config/injectTestConfig';

// Inject booking config before navigation - app reads on load
await injectTestConfig(page, CONFIG_INJECTION_KEYS.BOOKING, bookingOverrides);
```

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
- Check browser console for config injection logs
- Ensure navigation happens after injection (injection must be in `addInitScript`)

### Parallel test conflicts
- Each worker gets a unique ID for resource isolation
- If you see conflicts, ensure you're not sharing mutable state between tests

## Further Reading

- [Config-Aware Testing Architecture](../CONFIG_AWARE_TESTING_ARCHITECTURE.md) - Deep dive into the architecture
- [E2E Coverage Gap Analysis](../E2E_COVERAGE_GAP_ANALYSIS.md) - Coverage status and roadmap
