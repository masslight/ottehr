# Test Config Pattern: Direct Injection

## The Evolution

### ❌ First Attempt: Accessing Private Defaults

Initially, capability configs tried to access `INTAKE_PAPERWORK_DEFAULTS` directly:

```typescript
import { INTAKE_PAPERWORK_DEFAULTS } from '../ottehr-config/intake-paperwork';

const hiddenFieldsConfig = {
  ...INTAKE_PAPERWORK_DEFAULTS,
  FormFields: {
    ...INTAKE_PAPERWORK_DEFAULTS.FormFields,
    contactInformation: {
      ...INTAKE_PAPERWORK_DEFAULTS.FormFields.contactInformation,
      hiddenFields: ['patient-previous-name'],
    },
  },
};
```

This violated encapsulation - `DEFAULTS` should be private to the config module.

### ❌ Second Attempt: Environment Variables

Next, we tried injecting overrides via environment variables:

```typescript
// Problems:
// 1. Race conditions: Multiple parallel tests writing to same env var
// 2. Side effects: Global state mutation
// 3. Complexity: JSON serialization/deserialization
process.env.TEST_INTAKE_PAPERWORK_OVERRIDES = JSON.stringify(overrides);
```

This created race conditions when running tests in parallel.

## ✅ The Solution: Direct Config Injection

Capability configs define **override objects** that get merged with defaults **on-demand**:

```typescript
// Define overrides
export const CAPABILITY_TEST_CONFIGS = {
  'hidden-fields': {
    name: 'Hidden Fields',
    description: 'Tests form with specific fields hidden',
    overrides: {
      FormFields: {
        contactInformation: {
          hiddenFields: ['patient-previous-name'],
        },
      },
    },
  },
};
```

Tests create isolated config instances by passing overrides directly:

```typescript
// In getIntakePaperworkConfig() - streamlined with default parameter
export function getIntakePaperworkConfig(
  testOverrides: Partial<typeof INTAKE_PAPERWORK_DEFAULTS> = OVERRIDES
): any {
  const IntakePaperworkConfigSchema = QuestionnaireConfigSchema.extend({
    FormFields: FormFieldsSchema,
  });
  const mergedConfig = mergeAndFreezeConfigObjects(INTAKE_PAPERWORK_DEFAULTS, testOverrides);
  return IntakePaperworkConfigSchema.parse(mergedConfig);
}

// Production: Uses downstream OVERRIDES (default parameter)
export const INTAKE_PAPERWORK_CONFIG = getIntakePaperworkConfig();

// Tests: Pass capability config overrides explicitly
const testConfig = getIntakePaperworkConfig(capabilityOverrides);
```

**Note**: The `testOverrides` parameter defaults to `OVERRIDES`, so:
- Production (no args): `DEFAULTS` + `OVERRIDES` (downstream customizations)
- Tests (with args): `DEFAULTS` + `testOverrides` (capability config)

This streamlined approach uses a default parameter instead of nullish coalescing, making the code cleaner while maintaining the same behavior.

## Usage in Tests

```typescript
import { createConfigForTest } from 'utils/ottehr-config-test-fixtures';
import { ConfigHelper } from '../utils/config/ConfigHelper';

// Create config instance for this test suite
const testConfig = createConfigForTest('hidden-fields');

test.describe('Contact Info', () => {
  test('adapts to config', async ({ page }) => {
    // Pass config to helpers - no global state!
    const title = ConfigHelper.getPageTitle('contactInformation', testConfig);
    const visibleFields = ConfigHelper.getVisibleFields(testConfig.contactInformation);
    
    // Tests verify UI matches the config
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });
});
```

## Why Direct Injection is Better

1. **No Race Conditions**: Each test gets its own config instance - no shared state
2. **Pure Functions**: ConfigHelper methods are stateless and predictable
3. **Parallel Execution**: Tests can run in parallel without interfering
4. **Explicit Dependencies**: Clear what config each test uses (no hidden env vars)
5. **Encapsulation**: `DEFAULTS` stays private to the config module
6. **Same Pattern as Production**: Test overrides use same merge logic as downstream repos
7. **Simpler**: No environment variable serialization/deserialization
8. **Better Testability**: Pure functions are easier to test and reason about

## How createConfigForTest Works

```typescript
export function createConfigForTest(configName: string): IntakePaperworkConfig {
  const capability = getCapabilityConfig(configName);
  return getIntakePaperworkConfig(capability.overrides);
}
```

Each call creates a **new, isolated config instance** by:
1. Looking up the capability config by name
2. Passing its overrides to `getIntakePaperworkConfig()`
3. Returning a merged config: `DEFAULTS` + `OVERRIDES` + `testOverrides`

No global state. No side effects. Just pure config merging.
        },
      },
    },
  },
};
```

Both follow the same pattern: define overrides, let the config system merge them with defaults.
