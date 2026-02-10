# Config-Aware Testing Pilot

## Overview

This pilot demonstrates a config-aware testing approach that allows e2e tests to adapt automatically to configuration changes without hardcoded expectations.

## What's Been Created

### 1. Capability Test Fixtures (`packages/utils/lib/ottehr-config-test-fixtures/`)

Abstract test configurations that exercise different config patterns:
- **baseline**: Default config with no overrides
- **hidden-fields**: Various fields hidden via `hiddenFields` array
- **custom-copy**: Customized page titles and labels

### 2. ConfigHelper Utility (`apps/intake/tests/utils/config/ConfigHelper.ts`)

Helper methods that derive test expectations from configuration:
- `getPageTitle()` - Get page titles from config instead of hardcoding "Contact information"
- `getVisibleFields()` - Determine which fields should be visible based on `hiddenFields`
- `getRequiredFields()` - Get required fields from config
- `isFieldHidden()` - Check if a field is hidden (static check, triggers TODO)
- `getDropdownOptions()` - Get dropdown options from VALUE_SETS

### 3. Pilot Test File (`apps/intake/tests/pilot/contact-info-config-aware.spec.ts`)

Example tests demonstrating the pattern:
- ✅ Verifies page title from config
- ✅ Checks visible fields match config
- ✅ Validates hidden fields are not shown
- ✅ Enforces correct required fields
- ✅ Validates dropdown options from config

## Running the Pilot

```bash
# Run with baseline config (default)
npm run test:e2e -- tests/pilot/contact-info-config-aware.spec.ts

# Run with hidden-fields capability config
TEST_CONFIG=hidden-fields npm run test:e2e -- tests/pilot/contact-info-config-aware.spec.ts

# Run with custom-copy capability config
TEST_CONFIG=custom-copy npm run test:e2e -- tests/pilot/contact-info-config-aware.spec.ts

# Run all configs in parallel (no race conditions!)
npm run test:e2e -- tests/pilot/contact-info-config-aware.spec.ts --workers=3
```

## How It Works

Tests create isolated config instances using `createConfigForTest()`:

```typescript
// Each test suite gets its own config instance
const testConfig = createConfigForTest('hidden-fields');

// Pass config explicitly to helpers - no global state!
const title = ConfigHelper.getPageTitle('contactInformation', testConfig);
```

This pattern:
- ✅ **Enables parallel execution** - no shared state or race conditions
- ✅ **Pure functions** - ConfigHelper methods are stateless
- ✅ **Respects encapsulation** - doesn't access private defaults
- ✅ **Uses same merge mechanism** as downstream repos
- ✅ **Explicit dependencies** - clear what config each test uses

## What to Evaluate

### Success Criteria

1. **Does it catch real issues?**
   - Modify `hidden-fields` config to hide a field
   - Does test correctly skip validation for that field?
   - Modify `custom-copy` config to change a page title
   - Does test correctly expect the new title?

2. **Is migration effort reasonable?**
   - Count lines changed in pilot
   - How many hardcoded values remain in Paperwork.ts?
   - Could this pattern scale to all ~1200 lines of Paperwork.ts?

3. **Does it provide better error messages?**
   - When a test fails, does the error clearly indicate what config expected vs what was found?
   - Example: "Expected field 'patient-zip' to be visible but it was not found. This field is not in hiddenFields: [patient-street-address-2]"

4. **Performance impact?**
   - Does config lookup add noticeable overhead?
   - Is it worth it for the flexibility gained?

## Next Steps Based on Results

### If Pilot Succeeds ✅
- Migrate more of Paperwork.ts to use ConfigHelper
- Add capability test runner (parameterize over configs)
- Implement trigger evaluation in ConfigHelper
- Expand to other pages (Patient Details, Payment, etc.)

### If Pilot Reveals Issues ⚠️
- Identify blockers or unexpected complications
- Adjust approach before large-scale migration
- May need to enhance ConfigHelper capabilities
- May need different strategy for certain test types

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `packages/utils/lib/ottehr-config-test-fixtures/capability-configs.ts` | Define abstract test configs | ✅ Created |
| `packages/utils/lib/ottehr-config-test-fixtures/helpers.ts` | Config injection helpers | ✅ Created |
| `apps/intake/tests/utils/config/ConfigHelper.ts` | Config-aware test utilities | ✅ Created |
| `apps/intake/tests/pilot/contact-info-config-aware.spec.ts` | Example config-aware tests | ✅ Created |
| `apps/intake/tests/utils/Paperwork.ts` | Existing utility (needs migration) | ⏳ Pending |

## Comparison: Before vs After

### Before (Hardcoded)
```typescript
// In Paperwork.ts
private language = ['English', 'Spanish'];

async checkCorrectPageOpens(title: string) {
  await expect(this.locator.flowHeading).toHaveText(title);
}

// In test
await paperwork.checkCorrectPageOpens('Contact information');
```

### After (Config-Aware)
```typescript
// In ConfigHelper.ts
static getDropdownOptions(valueSetKey: keyof typeof VALUE_SETS) {
  return VALUE_SETS[valueSetKey];
}

static getPageTitle(pageKey: keyof typeof INTAKE_PAPERWORK_CONFIG) {
  return INTAKE_PAPERWORK_CONFIG[pageKey].title;
}

// In test
const expectedOptions = ConfigHelper.getDropdownOptions('languageOptions');
const expectedTitle = ConfigHelper.getPageTitle('contactInformation');
await expect(page.getByRole('heading', { name: expectedTitle })).toBeVisible();
```

## Questions for Evaluation

1. Are the config helpers intuitive to use?
2. Do the tests read more clearly or less clearly than before?
3. Would you be comfortable migrating ~1200 more lines using this pattern?
4. What edge cases or challenges did you encounter?
5. Does this actually solve the downstream config problem?
