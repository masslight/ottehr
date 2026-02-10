/**
 * PILOT: Config-aware contact information page tests
 *
 * This is a proof-of-concept demonstrating how tests can derive expectations
 * from configuration rather than hardcoded values. This allows tests to
 * automatically adapt to downstream customizations.
 *
 * Run against multiple capability configs to validate the approach:
 * - baseline: default config
 * - hidden-fields: some fields hidden
 * - custom-copy: different page titles
 *
 * Usage:
 * ```bash
 * # Run with default config
 * npm run test:e2e -- tests/pilot/contact-info-config-aware.spec.ts
 *
 * # Run with hidden-fields config
 * TEST_CONFIG=hidden-fields npm run test:e2e -- tests/pilot/contact-info-config-aware.spec.ts
 * ```
 */

import { expect, test } from '@playwright/test';
import { createConfigForTest } from 'utils/lib/ottehr-config-test-fixtures';
import { ConfigHelper } from '../utils/config/ConfigHelper';
import { Paperwork } from '../utils/Paperwork';

// Check if a specific test config was requested
const TEST_CONFIG = process.env.TEST_CONFIG || 'baseline';

// Create config instance for this test suite
const testConfig = createConfigForTest(TEST_CONFIG);

test.describe(`Contact Information Page (Config: ${TEST_CONFIG})`, () => {
  test.beforeEach(async () => {
    // TODO: Navigate to paperwork flow
    // For now this is just demonstrating the config-aware pattern
  });

  test('renders correct page title from config', async ({ page }) => {
    const expectedTitle = ConfigHelper.getPageTitle('contactInformation', testConfig);

    await expect(page.getByRole('heading', { name: expectedTitle })).toBeVisible();
  });

  test('shows all visible fields based on hiddenFields config', async ({ page }) => {
    const section = testConfig.contactInformation;
    const visibleFields = ConfigHelper.getVisibleFields(section);

    for (const field of visibleFields) {
      // Check field is visible using its label
      const fieldLocator = page.getByLabel(new RegExp(field.label, 'i'));
      await expect(fieldLocator)
        .toBeVisible({
          timeout: 5000,
        })
        .catch(() => {
          throw new Error(
            `Expected field "${field.label}" (key: ${field.key}) to be visible but it was not found. ` +
              `This field is not in hiddenFields: [${section.hiddenFields?.join(', ')}]`
          );
        });
    }
  });

  test('hides fields that are in hiddenFields config', async ({ page }) => {
    const section = testConfig.contactInformation;
    const hiddenFieldKeys = section.hiddenFields || [];

    // For each hidden field, verify it's not visible
    for (const fieldKey of hiddenFieldKeys) {
      // Use data-testid for hidden field checks
      const fieldLocator = page.getByTestId(fieldKey);

      // Field should either not exist or not be visible
      const isVisible = await fieldLocator.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }
  });

  test('enforces correct required fields from config', async ({ page }) => {
    const section = testConfig.contactInformation;
    const requiredFields = ConfigHelper.getRequiredFields(section);

    // Try to continue without filling any fields
    await page.getByRole('button', { name: /continue/i }).click();

    // Should see validation errors for each required field
    for (const fieldKey of requiredFields) {
      // Check if this field is hidden - skip validation if so
      if (ConfigHelper.isFieldHidden(fieldKey, section)) {
        continue;
      }

      const errorLocator = page.getByTestId(`${fieldKey}-error`);
      await expect(errorLocator)
        .toBeVisible({
          timeout: 3000,
        })
        .catch(() => {
          throw new Error(
            `Expected validation error for required field "${fieldKey}" but none was shown. ` +
              `Required fields per config: [${requiredFields.join(', ')}]`
          );
        });
    }
  });

  test('dropdown options match config value sets', async ({ page }) => {
    const section = testConfig.contactInformation;

    // Skip if preferred-communication-method is hidden
    if (ConfigHelper.isFieldHidden('patient-preferred-communication-method', section)) {
      test.skip();
    }

    // Get expected options from config
    const expectedOptions = ConfigHelper.getDropdownOptions('preferredCommunicationMethodOptions');

    // Click the preferred communication dropdown
    await page.getByLabel(/preferred communication method/i).click();

    // Verify all expected options are present
    for (const option of expectedOptions) {
      await expect(page.getByRole('option', { name: option.label })).toBeVisible();
    }
  });
});

test.describe('Contact Information - Integration with existing Paperwork util', () => {
  let paperwork: Paperwork;

  test.beforeEach(async ({ page }) => {
    paperwork = new Paperwork(page);
    // TODO: Navigate to paperwork flow
  });

  test('checkCorrectPageOpens uses config-derived title', async () => {
    // Demonstration of how to update existing helper
    const expectedTitle = ConfigHelper.getPageTitle('contactInformation', testConfig);

    // Old way (hardcoded):
    // await paperwork.checkCorrectPageOpens('Contact information');

    // New way (config-aware):
    await expect(paperwork.locator.flowHeading).toHaveText(expectedTitle);
  });

  test('fillContactInformation adapts to visible fields', async () => {
    const section = testConfig.contactInformation;
    const visibleFields = ConfigHelper.getVisibleFields(section);

    // Example: Only try to fill fields that are actually visible
    // When implementing, check if field is in visibleFields before filling:
    // if (visibleFields.some(f => f.key === 'patient-street-address-2')) {
    //   await page.getByLabel(/address line 2/i).fill('Test Address Line 2');
    // }
    expect(visibleFields.length).toBeGreaterThan(0);
  });
});
