# Intake E2E Test Scaling Analysis

## Overview

As we scale from 4 to 6+ downstream repositories, the intake app's e2e test architecture faces two interconnected challenges:

1. **Test Implementation Problem:** Tests contain hardcoded expectations that mirror the core repo's configuration, causing failures when downstream repos customize their configuration - even when the app behaves correctly.

2. **Workflow Problem:** The only way to validate that core code handles a downstream's configuration is to run tests in that downstream repo, creating a slow, error-prone fan-out development cycle.

These problems share a root cause: **the app is designed for customization via `ottehr-config`, but the tests are not.**

### The Solution: Contract-Based Testing

The proposed solution is a **contract-based testing architecture** where:

- **Upstream** tests the configuration *contract* - proving that any schema-valid configuration will work correctly
- **Downstream** validates that its specific configuration satisfies the contract, and in a way that meets the product specification for that particular instance

This approach works within a critical constraint: the upstream repo is **public** while downstream repos are **private**, so we cannot test against actual downstream configurations in upstream. Instead, we test against abstract **capability configurations** that exercise all the patterns the schema allows.

Downstream validation has two parts:
1. **Contract validation** - "Will this config work?" (schema validity, field references)
2. **Product specification** - "Is this config correct for our product?" (business requirements)

**The guarantee:** If upstream capability tests pass, downstream contract validation passes, and downstream product specification tests pass, the downstream will work correctly for its specific use case.

---

## The Two Challenges in Detail

### Challenge 1: Hardcoded Test Expectations

The current test implementation is tightly coupled to the core repo's default configuration:

| What's Hardcoded | Example | Should Come From |
|------------------|---------|------------------|
| Page titles | `'Contact information'` | `INTAKE_PAPERWORK_CONFIG.contactInformation.title` |
| Dropdown options | `['English', 'Spanish']` | `VALUE_SETS.languageOptions` |
| Button text | `'Proceed to paperwork'` | Config or branding |
| Validation messages | `'Phone number must be 10 digits...'` | i18n/translation config |
| Required fields | Assumes specific fields required | `requiredFields` arrays |
| Field visibility | Assumes all fields exist | `hiddenFields` and `triggers` |

When a downstream repo customizes any of these, tests fail even though the app is working correctly.

### Challenge 2: The Fan-Out Testing Bottleneck

The development cycle for core changes currently looks like:

```
Developer makes change in upstream
         ↓
Merge to upstream (untested against downstream configs)
         ↓
Check out downstream repo #1 → pull upstream → run tests → find failure
         ↓
Return to upstream, fix, merge
         ↓
Repeat for repos #2, #3, #4, #5, #6...
```

This creates:
- **Slow feedback loops** multiplied by N downstream repos
- **Downstream-breaking changes merged upstream** before anyone knows
- **Developer friction** leading to deferred or skipped validation
- **Cascading disruption** for other developers pulling upstream

### The Constraint: Public Upstream, Private Downstreams

We cannot simply test against all downstream configs in upstream because:
- The upstream ottehr-core repo is **public**
- Downstream repos are **private**
- We cannot expose client configurations or identifying details

This means we must test the **abstract contract** rather than specific implementations.

---

## The Contract-Based Testing Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UPSTREAM REPO (PUBLIC)                       │
├─────────────────────────────────────────────────────────────────┤
│  ottehr-config/                 (base defaults)                 │
│  ottehr-config-test-fixtures/   (abstract capability configs)   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    TEST SUITE                            │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │   │
│  │  │ Property      │  │ Component     │  │ E2E Tests   │  │   │
│  │  │ Tests         │  │ Tests         │  │ (full flow) │  │   │
│  │  │ (schema-      │  │ (unit +       │  │             │  │   │
│  │  │ generated)    │  │ integration)  │  │             │  │   │
│  │  └───────────────┘  └───────────────┘  └─────────────┘  │   │
│  │           ↑                ↑                 ↑          │   │
│  │           └────────────────┴─────────────────┘          │   │
│  │              Run against CAPABILITY configs             │   │
│  │  [baseline] [hidden] [triggers] [minimal] [maximal] ... │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CI: Block merge if ANY capability config fails                │
│  CONTRACT: "If your config is schema-valid, it will work"      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Contract guarantee
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  DOWNSTREAM REPOS (PRIVATE)                     │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  Downstream A│  Downstream B│  Downstream C│  ...              │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│  Each downstream:                                               │
│  1. Defines ottehr-config-overrides/ (their custom config)     │
│  2. Runs contract validation tests:                            │
│     - Config passes Zod schema ✓                               │
│     - All field keys are valid ✓                               │
│     - All trigger targets exist ✓                              │
│  3. Runs product specification tests:                          │
│     - Config matches this product's requirements ✓             │
│     - Branding, fields, service categories correct ✓           │
│                                                                 │
│  Contract + product spec pass → upstream changes are safe      │
│  (No E2E tests needed - upstream capability tests cover it)    │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Schema** | Defines valid config shapes | `ottehr-config/*.schema.ts` |
| **Capability Tests** | Proves all schema-valid patterns work | Upstream test suite |
| **Property Tests** | Catches edge cases via random generation | Upstream test suite |
| **Contract Validation** | Proves downstream config is schema-valid | Downstream test suite |
| **Product Specification** | Proves config meets this product's requirements | Downstream test suite |

---

## Part 1: Current Test Implementation Issues

This section documents the specific hardcoded values in the current test implementation that need to be replaced with config-derived values.

### 1. Hardcoded Page Titles

**Location:** `apps/intake/tests/utils/Paperwork.ts` (lines 281-409+)

Tests validate page navigation via `checkCorrectPageOpens()` with literal strings:

```typescript
await this.checkCorrectPageOpens('Contact information');
await this.checkCorrectPageOpens('Patient details');
await this.checkCorrectPageOpens('How would you like to pay for your visit?');
await this.checkCorrectPageOpens('Complete consent forms');
```

**Configuration reality:** Page titles are defined in `ottehr-config` (e.g., `intake-paperwork/index.ts:21` has `title: 'Contact information'`). Downstream repos can override these via `ottehr-config-overrides`, but tests will fail because they expect the original strings.

---

### 2. Hardcoded Dropdown Options

**Location:** `apps/intake/tests/utils/Paperwork.ts` (lines 207-226)

The test utility explicitly defines expected dropdown values:

```typescript
private language = ['English', 'Spanish'];
private relationshipResponsiblePartyNotSelf = ['Legal Guardian', 'Parent', 'Other', 'Spouse'];
private birthSex = ['Male', 'Female', 'Intersex'];
private pronouns = ['He/him', 'She/her', 'They/them', 'My pronouns are not listed'];
private pointOfDiscovery = [
  'Friend/Family', 'Been there with another family member', 'Healthcare Professional',
  'Google/Internet search', 'Internet ad', 'Social media community group', ...
];
```

**Configuration reality:** These values come from `value-sets/index.ts` and are fully overridable. Downstream repos frequently customize these (e.g., different languages, different referral sources), causing test failures.

---

### 3. Hardcoded Validation Messages

**Location:** `apps/intake/tests/utils/Locators.ts` (lines 108-112)

```typescript
this.numberErrorText = page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
this.emailErrorText = page.getByText('Email is not valid');
this.zipErrorText = page.getByText('ZIP Code must be 5 numbers');
this.dateOlder18YearsError = page.getByText('Must be 18 years or older');
```

**Problem:** Validation messages are derived from the app's i18n/translation system. Downstream repos with custom translations or different validation rules will break these tests.

---

### 4. Hardcoded Button/Link Text

**Location:** `apps/intake/tests/utils/Locators.ts` (lines 33-86)

```typescript
this.proceedToPaperwork = page.getByRole('button', { name: 'Proceed to paperwork' });
this.bookAgainButton = page.getByRole('button', { name: 'Book again' });
this.goToWaitingRoomButton = page.getByRole('button', { name: 'Go to the Waiting Room' });
this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
```

**Problem:** These strings are hardcoded rather than being sourced from configuration. The locator strategy itself (using `getByRole` with accessible names) is correct per Playwright best practices - the issue is that the expected text values are literals instead of config-derived.

---

### 5. Hardcoded Form Field Expectations

The tests assume a specific set of form pages exist in a specific order:

1. Contact information
2. Patient details
3. Primary Care Physician
4. Preferred pharmacy
5. Payment
6. Credit card
7. Responsible party
8. Emergency Contact
9. Photo ID
10. Consent forms
11. Medical history

**Configuration reality:** Pages can be:
- Hidden entirely via `hiddenFields`
- Made conditional via `triggers`
- Reordered in downstream implementations
- Service-category-dependent (e.g., Employer Information only for occupational medicine)

---

### 6. No Test Data Factory Aligned with Configuration

The test data generation (`0_paperworkSetup/setup.spec.ts`) creates patients with specific scenarios, but:

- Uses hardcoded test values
- Doesn't generate data based on `requiredFields` or `hiddenFields` from config
- Cannot dynamically adapt to which fields are mandatory in a downstream repo

---

### 7. Limited Configuration Awareness

While tests do reference `BOOKING_CONFIG` and `BRANDING_CONFIG` for some conditional logic:

```typescript
if (!BOOKING_CONFIG.homepageOptions.includes('schedule-virtual-visit')) {
  test.skip();
}
```

This is only used for **skipping entire tests**, not for **adapting expectations**. The `INTAKE_PAPERWORK_CONFIG` (which defines form structure) is not consulted at all.

---

### 8. No Abstraction for Configurable Elements

There's no intermediate layer that:
- Reads page titles from `INTAKE_PAPERWORK_CONFIG`
- Derives expected dropdown options from `VALUE_SETS`
- Checks `hiddenFields` before expecting a field to exist
- Evaluates `triggers` to determine which fields should appear

---

### 9. Branding Partially Addressed, But Incomplete

Some branding is dynamic:

```typescript
this.thankYouHeading = page.getByRole('heading', {
  name: `Thank you for choosing ${BRANDING_CONFIG.projectName}!`,
});
```

But many other branding-affected strings remain hardcoded.

---

### Impact Summary

| Customization Type | Current Test Behavior | Result |
|--------------------|----------------------|--------|
| Custom page titles | Hardcoded string match | Test failure |
| Different dropdown options | Hardcoded array comparison | Test failure |
| Hidden/conditional fields | Assumes all fields exist | Test failure or false positive |
| Custom validation messages | Hardcoded text match | Test failure |
| Different required fields | Hardcoded field expectations | Test failure |
| Custom branding text | Partially hardcoded | Some failures |

### File Reference

| File | Purpose | Issue |
|------|---------|-------|
| `apps/intake/tests/utils/Paperwork.ts` | Main paperwork flow utility | ~1200 lines, extensive hardcoding |
| `apps/intake/tests/utils/Locators.ts` | UI element selectors | ~900 lines, hardcoded text values in locators |
| `apps/intake/tests/utils/QuestionnaireHelper.ts` | Questionnaire validation | Config-aware but limited |
| `packages/utils/lib/ottehr-config/` | Configuration definitions | Source of truth (not used by tests) |

---

## Part 2: The Workflow Problem

### Current Developer Experience

```
Developer makes change in upstream
         ↓
Merge to upstream (untested against downstream configs)
         ↓
Check out downstream repo #1 → pull upstream → run tests → find failure
         ↓
Return to upstream, fix, merge
         ↓
Check out downstream repo #1 again → pull → test → pass
         ↓
Check out downstream repo #2 → pull upstream → run tests → find different failure
         ↓
Return to upstream, fix, merge
         ↓
Check out downstream repo #1 again → pull → test → pass
         ↓
Repeat for repos #3, #4, #5, #6...
```

### Why This Happens

The core config-interpreting code lives upstream, but the only way to know if it handles a given configuration correctly is to run tests *in the downstream repo that uses that configuration*. There is no mechanism to test the full universe of supported configurations from within upstream.

### Desired Developer Experience

```
Developer makes change in upstream
         ↓
Run tests locally against capability configs (fast feedback)
         ↓
Fix any failures immediately
         ↓
CI runs full capability matrix, blocks merge if any fails
         ↓
Merge to upstream (validated against the contract)
         ↓
Downstream repos pull upstream with confidence
```

---

## Implementing the Contract-Based Approach

### Step 1: Define Configuration Capabilities

Enumerate the discrete configuration capabilities the system must support:

| Capability | Description | Config Mechanism |
|------------|-------------|------------------|
| Hidden fields | Any field can be hidden | `hiddenFields: ['field-key']` |
| Required field overrides | Any field's required status can change | `requiredFields: ['field-key']` |
| Conditional visibility | Fields shown/hidden based on other values | `triggers` with `effect: 'enable'` |
| Conditional requirements | Fields required based on other values | `triggers` with `effect: 'require'` |
| Custom value sets | Dropdown options can be customized | `VALUE_SETS` overrides |
| Custom page titles | Section headings can be changed | `title` property overrides |
| Page exclusion | Entire pages can be removed | Page-level `hiddenFields` or triggers |
| Service-category routing | Different flows per service type | `serviceCategory` triggers |
| Custom validation messages | Error text can be localized | i18n/translation overrides |
| Custom button/link text | UI copy can be customized | Branding/copy config |

---

### Step 2: Create Abstract Capability Test Configs

Build synthetic test configurations that exercise each capability in isolation and in combination. These configs are abstract - they don't represent any real client:

```typescript
// packages/utils/lib/ottehr-config-test-fixtures/index.ts

export const CAPABILITY_TEST_CONFIGS = {
  // Baseline: default config with no overrides
  baseline: {
    name: 'baseline',
    description: 'Default configuration with no overrides',
    config: INTAKE_PAPERWORK_DEFAULTS,
  },

  // Hidden fields capability
  hiddenFields: {
    name: 'hidden-fields',
    description: 'Config with various fields hidden',
    config: deepMerge(INTAKE_PAPERWORK_DEFAULTS, {
      contactInformation: {
        hiddenFields: ['patient-street-address-2', 'mobile-opt-in'],
      },
      patientDetails: {
        hiddenFields: ['patient-pronouns', 'patient-point-of-discovery'],
      },
    }),
  },

  // Required field overrides
  extendedRequirements: {
    name: 'extended-requirements',
    description: 'Config with additional required fields',
    config: deepMerge(INTAKE_PAPERWORK_DEFAULTS, {
      contactInformation: {
        requiredFields: [...DEFAULT_REQUIRED, 'patient-street-address-2'],
      },
    }),
  },

  // Conditional triggers
  complexTriggers: {
    name: 'complex-triggers',
    description: 'Config with conditional field visibility',
    config: deepMerge(INTAKE_PAPERWORK_DEFAULTS, {
      photoIdPage: {
        triggers: [
          {
            targetQuestionLinkId: 'some-field',
            effect: ['enable'],
            operator: '=',
            answerString: 'specific-value',
          },
        ],
      },
    }),
  },

  // Custom value sets
  customValueSets: {
    name: 'custom-value-sets',
    description: 'Config with customized dropdown options',
    config: INTAKE_PAPERWORK_DEFAULTS,
    valueSets: {
      languageOptions: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
      ],
      pointOfDiscoveryOptions: [
        { value: 'web', label: 'Website' },
        { value: 'referral', label: 'Referral' },
      ],
    },
  },

  // Custom titles/copy
  customCopy: {
    name: 'custom-copy',
    description: 'Config with customized page titles and text',
    config: deepMerge(INTAKE_PAPERWORK_DEFAULTS, {
      contactInformation: {
        title: 'Your Contact Details',
      },
      patientDetails: {
        title: 'About the Patient',
      },
    }),
  },

  // Minimal config (many fields hidden)
  minimal: {
    name: 'minimal',
    description: 'Config with maximum fields hidden',
    config: deepMerge(INTAKE_PAPERWORK_DEFAULTS, {
      contactInformation: {
        hiddenFields: ['patient-street-address-2', 'mobile-opt-in', 'patient-preferred-communication-method'],
      },
      patientDetails: {
        hiddenFields: ['patient-pronouns', 'patient-point-of-discovery', 'patient-preferred-language'],
      },
      pcpPage: {
        hiddenFields: ['*'], // Entire page hidden
      },
    }),
  },

  // Maximal config (all optional fields shown and required)
  maximal: {
    name: 'maximal',
    description: 'Config with all fields visible and required',
    config: deepMerge(INTAKE_PAPERWORK_DEFAULTS, {
      contactInformation: {
        hiddenFields: [],
        requiredFields: ['*'],
      },
      // ... etc
    }),
  },
};
```

---

### Step 3: Parameterized Tests Against Capability Configs

Run every test against every capability config:

```typescript
import { CAPABILITY_TEST_CONFIGS } from 'utils/ottehr-config-test-fixtures';

const configs = Object.values(CAPABILITY_TEST_CONFIGS);

for (const { name, description, config } of configs) {
  test.describe(`Intake paperwork [${name}]: ${description}`, () => {
    test.beforeAll(() => {
      setActiveConfig(config);
    });

    test('renders contact information page correctly', async ({ page }) => {
      // Expectations derived from the active config
      await checkPageOpens(config.contactInformation.title);

      // Only check for fields that aren't hidden
      for (const field of getVisibleFields(config.contactInformation)) {
        await expect(page.getByLabel(field.label)).toBeVisible();
      }

      // Hidden fields should not appear
      for (const fieldKey of config.contactInformation.hiddenFields) {
        await expect(page.getByTestId(fieldKey)).not.toBeVisible();
      }
    });

    test('enforces correct required fields', async ({ page }) => {
      // Submit without filling required fields
      await page.click('button:has-text("Continue")');

      // Should see validation errors for required fields only
      for (const fieldKey of config.contactInformation.requiredFields) {
        await expect(page.getByTestId(`${fieldKey}-error`)).toBeVisible();
      }
    });
  });
}
```

---

### Step 4: Component-Level Capability Tests

Fast unit/integration tests that verify config interpretation without full E2E:

```typescript
import { CAPABILITY_TEST_CONFIGS } from 'utils/ottehr-config-test-fixtures';

describe('FormFieldRenderer', () => {
  describe.each(Object.entries(CAPABILITY_TEST_CONFIGS))('%s config', (name, { config }) => {
    it('respects hiddenFields', () => {
      const rendered = renderForm(config.contactInformation);
      for (const hiddenKey of config.contactInformation.hiddenFields) {
        expect(rendered.queryByTestId(hiddenKey)).toBeNull();
      }
    });

    it('respects requiredFields', () => {
      const rendered = renderForm(config.contactInformation);
      for (const requiredKey of config.contactInformation.requiredFields) {
        expect(rendered.getByTestId(requiredKey)).toHaveAttribute('required');
      }
    });
  });
});

describe('Trigger evaluation', () => {
  describe.each(Object.entries(CAPABILITY_TEST_CONFIGS))('%s config', (name, { config }) => {
    it('evaluates enable triggers correctly', () => {
      const triggers = config.photoIdPage?.triggers ?? [];
      for (const trigger of triggers.filter(t => t.effect.includes('enable'))) {
        // Test that trigger logic works
        const result = evaluateTrigger(trigger, mockFormState);
        expect(result).toBeDefined();
      }
    });
  });
});
```

---

### Step 5: Schema-Driven Property Testing

Use property-based testing to generate random valid configs from the schema:

```typescript
import * as fc from 'fast-check';
import { IntakePaperworkConfigSchema } from 'utils/ottehr-config';

describe('Config interpreter handles all valid schemas', () => {
  it('renders without crashing for any valid config', () => {
    fc.assert(
      fc.property(
        fc.record({
          contactInformation: fc.record({
            title: fc.string(),
            hiddenFields: fc.array(fc.constantFrom(...ALL_FIELD_KEYS)),
            requiredFields: fc.array(fc.constantFrom(...ALL_FIELD_KEYS)),
          }),
          // ... other sections
        }),
        (randomConfig) => {
          // Validate it's a legal config
          const parsed = IntakePaperworkConfigSchema.safeParse(randomConfig);
          if (!parsed.success) return true; // Skip invalid configs

          // Should render without throwing
          expect(() => renderForm(parsed.data)).not.toThrow();
        }
      )
    );
  });
});
```

This catches edge cases no real downstream uses but the schema technically allows.

---

### Step 6: Downstream Validation (Contract + Product Specification)

Downstream repos need to validate TWO distinct things:

| Validation Type | Question Answered | Owned By |
|-----------------|-------------------|----------|
| **Contract validation** | "Will this config work with upstream code?" | Upstream (schema + capability tests) |
| **Product specification** | "Is this config correct for our specific product?" | Downstream (product spec tests) |

A config can be perfectly valid and work correctly, but still be *wrong* for a specific client's needs - wrong fields visible, wrong defaults, missing required service categories, etc.

#### Part A: Contract Validation

These tests prove the config will work with upstream code:

```typescript
// tests/config-contract.spec.ts
import { INTAKE_PAPERWORK_CONFIG } from 'utils';

describe('Upstream contract validation', () => {
  it('config is valid per upstream schema', () => {
    expect(() => IntakePaperworkConfigSchema.parse(INTAKE_PAPERWORK_CONFIG)).not.toThrow();
  });

  it('all referenced fields exist in base config', () => {
    for (const fieldKey of INTAKE_PAPERWORK_CONFIG.contactInformation.hiddenFields) {
      expect(ALL_VALID_FIELD_KEYS).toContain(fieldKey);
    }
  });

  it('all trigger targets exist', () => {
    const triggers = extractAllTriggers(INTAKE_PAPERWORK_CONFIG);
    for (const trigger of triggers) {
      expect(ALL_VALID_FIELD_KEYS).toContain(trigger.targetQuestionLinkId);
    }
  });
});
```

#### Part B: Product Specification Testing

These tests prove the config meets this specific product's business requirements. They live entirely in the downstream repo and are invisible to upstream.

**Approach 1: Explicit requirement assertions**

```typescript
// tests/product-spec.spec.ts
import { INTAKE_PAPERWORK_CONFIG, VALUE_SETS, BRANDING_CONFIG } from 'utils';

describe('Product specification: [Client Name] Intake', () => {
  describe('Branding requirements', () => {
    it('uses correct project name', () => {
      expect(BRANDING_CONFIG.projectName).toBe('Expected Client Name');
    });

    it('uses correct support phone number', () => {
      expect(BRANDING_CONFIG.supportPhone).toBe('1-800-XXX-XXXX');
    });
  });

  describe('Required fields per client contract', () => {
    it('SSN field is visible for occupational medicine', () => {
      // Client requires SSN collection for occ-med visits
      const ssnHidden = INTAKE_PAPERWORK_CONFIG.contactInformation.hiddenFields.includes('patient-ssn');
      expect(ssnHidden).toBe(false);
    });

    it('employer information page is enabled', () => {
      // Client requires employer info for workers comp
      const employerPageHidden = isPageHidden('employerInformation', INTAKE_PAPERWORK_CONFIG);
      expect(employerPageHidden).toBe(false);
    });
  });

  describe('Service categories', () => {
    it('supports required service categories', () => {
      const categories = BOOKING_CONFIG.serviceCategories.map(c => c.value);
      expect(categories).toContain('urgent-care');
      expect(categories).toContain('occupational-medicine');
      // Client does NOT offer virtual visits
      expect(categories).not.toContain('virtual-visit');
    });
  });

  describe('Value set customizations', () => {
    it('includes required language options', () => {
      const languages = VALUE_SETS.languageOptions.map(l => l.value);
      expect(languages).toContain('en');
      expect(languages).toContain('es');
      expect(languages).toContain('vi'); // Client-specific requirement
    });

    it('point of discovery includes client-specific options', () => {
      const options = VALUE_SETS.pointOfDiscoveryOptions.map(o => o.label);
      expect(options).toContain('Client Partner Referral'); // Custom option
    });
  });
});
```

**Approach 2: Snapshot-based specification**

For comprehensive coverage, maintain a snapshot of expected configuration:

```typescript
// tests/product-spec/expected-config.ts
export const EXPECTED_CONFIG = {
  branding: {
    projectName: 'Expected Client Name',
    supportPhone: '1-800-XXX-XXXX',
  },

  contactInformation: {
    title: 'Contact Information', // or custom title
    visibleFields: [
      'patient-street-address',
      'patient-city',
      'patient-state',
      'patient-zip',
      'patient-email',
      'patient-number',
      'patient-ssn', // Required for this client
    ],
    requiredFields: [
      'patient-street-address',
      'patient-email',
      'patient-number',
    ],
  },

  serviceCategories: ['urgent-care', 'occupational-medicine'],

  // ... other product requirements
};

// tests/product-spec.spec.ts
import { EXPECTED_CONFIG } from './product-spec/expected-config';

describe('Product specification snapshot', () => {
  it('branding matches specification', () => {
    expect(BRANDING_CONFIG.projectName).toBe(EXPECTED_CONFIG.branding.projectName);
    expect(BRANDING_CONFIG.supportPhone).toBe(EXPECTED_CONFIG.branding.supportPhone);
  });

  it('contact information page matches specification', () => {
    const actualVisible = getVisibleFieldKeys(INTAKE_PAPERWORK_CONFIG.contactInformation);
    expect(actualVisible).toEqual(expect.arrayContaining(EXPECTED_CONFIG.contactInformation.visibleFields));
  });

  it('service categories match specification', () => {
    const actualCategories = BOOKING_CONFIG.serviceCategories.map(c => c.value);
    expect(actualCategories.sort()).toEqual(EXPECTED_CONFIG.serviceCategories.sort());
  });
});
```

**Approach 3: Golden file comparison**

For the most rigorous validation, compare the entire resolved config against a golden file:

```typescript
// tests/product-spec.spec.ts
import { INTAKE_PAPERWORK_CONFIG } from 'utils';
import goldenConfig from './golden/intake-paperwork-config.json';

describe('Configuration golden file', () => {
  it('resolved config matches golden file', () => {
    // Deep comparison with helpful diff on failure
    expect(INTAKE_PAPERWORK_CONFIG).toMatchObject(goldenConfig);
  });
});
```

When requirements change, update the golden file deliberately and review the diff in code review.

#### Why Product Specification Tests Matter

| Scenario | Contract Validation | Product Spec | Outcome |
|----------|--------------------|--------------| --------|
| Config is schema-valid but missing required SSN field | ✅ Pass | ❌ Fail | Caught before deploy |
| Config works but has wrong branding | ✅ Pass | ❌ Fail | Caught before deploy |
| Upstream change removes a field this client needs | ✅ Pass | ❌ Fail | Caught on upstream pull |
| Developer accidentally hides required page | ✅ Pass | ❌ Fail | Caught in PR |

**The complete validation stack:**
- If upstream capability tests pass ✓
- And downstream config is schema-valid ✓
- And downstream config only references valid field keys ✓
- **And downstream config matches product specification ✓**
- Then downstream will work correctly for this specific product ✓

---

### Step 7: CI Structure

**Upstream CI (public):**
```yaml
name: Test Configuration Contract

on:
  pull_request:
    branches: [develop, main]

jobs:
  capability-tests:
    strategy:
      matrix:
        config: [baseline, hidden-fields, extended-requirements, complex-triggers, custom-value-sets, custom-copy, minimal, maximal]
    steps:
      - uses: actions/checkout@v4
      - name: Run tests with ${{ matrix.config }} config
        run: npm run test:intake -- --config=${{ matrix.config }}

  property-tests:
    steps:
      - uses: actions/checkout@v4
      - name: Run schema property tests
        run: npm run test:property
```

**Downstream CI (private):**
```yaml
name: Validate Downstream Config

on:
  pull_request:

jobs:
  contract-validation:
    steps:
      - uses: actions/checkout@v4
      - name: Validate config against upstream contract
        run: npm run test:config-contract

  product-spec-validation:
    steps:
      - uses: actions/checkout@v4
      - name: Validate config meets product specification
        run: npm run test:product-spec
```

**Why no E2E tests downstream?**

If downstream repos are purely "config injected into core code" (no custom application code), then:
- Upstream capability tests already prove the core code handles all valid config patterns
- Contract validation proves this config is valid
- Product specification proves this config is correct for the product

Running E2E tests downstream would redundantly re-prove what upstream already established. The coverage is complete without them.

---

## Recommendations for Test Implementation Fixes

These changes update the existing test utilities to derive expectations from configuration rather than hardcoded values.

### 1. Create a Test Configuration Layer

Build a utility that reads from `INTAKE_PAPERWORK_CONFIG`:
- Page titles from `FormFields.*.title`
- Expected fields from `FormFields.*.items`
- Required vs optional from `requiredFields` arrays and require-type triggers
- Field visibility from `hiddenFields` and `triggers`

### 2. Dynamic Dropdown Validation

Import `VALUE_SETS` and use those as the source of truth for expected options rather than hardcoded arrays.

### 3. Keep User-Facing Locators, Source Text from Config

Playwright best practices recommend user-facing locators (`getByRole`, `getByText`, `getByLabel`) over test IDs because they:
- Test what users actually see and interact with
- Surface accessibility issues (if a button lacks proper role/label, the test fails)
- Validate that configured text is actually rendered correctly

The problem isn't the locator strategy - it's hardcoded literals. The fix:

```typescript
// Current (bad): hardcoded text
this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });

// Better: text sourced from config
this.reserveButton = page.getByRole('button', { name: BOOKING_CONFIG.reserveButtonText });
```

This maintains user-facing test semantics while automatically adapting when downstream repos customize their copy.

### 4. Conditional Test Steps

Check config before asserting on optional pages/fields:

```typescript
// Example approach
if (!isFieldHidden('pcp-page', config)) {
  await this.checkCorrectPageOpens(config.pcpPage.title);
}
```

### 5. Test Data Factory

Generate appropriate values based on the active configuration:
- Only fill required fields when testing minimal flow
- Use valid options from configured value sets
- Respect field visibility rules

### 6. Abstract Page Expectations

Create a config-aware helper that encapsulates `checkCorrectPageOpens()` logic:

```typescript
// Example approach
async checkPageOpens(pageKey: keyof typeof FormFields): Promise<void> {
  const pageConfig = INTAKE_PAPERWORK_CONFIG[pageKey];
  if (isPageEnabled(pageKey)) {
    await expect(this.locator.flowHeading).toHaveText(pageConfig.title);
  }
}
```

---

## Next Steps

### Phase 1: Foundation
1. Audit all hardcoded strings in test utilities
2. Define the complete list of configuration capabilities
3. Create `ottehr-config-test-fixtures/` with abstract capability configs
4. Build test helpers that derive expectations from config

### Phase 2: Upstream Contract Tests
5. Implement parameterized tests that run against all capability configs
6. Add component-level capability tests for fast feedback
7. Add property-based tests for schema-driven edge case coverage
8. Configure upstream CI to run full capability matrix

### Phase 3: Downstream Integration
9. Create contract validation test suite for downstream repos
10. Create product specification test templates and patterns
11. Document the contract and how to validate new configs
12. Remove existing downstream E2E tests (now redundant)

### Phase 4: Refinement
13. Add new capability configs as edge cases are discovered
14. Expand property tests to cover more schema paths
15. Create tooling to help downstream authors validate configs locally
