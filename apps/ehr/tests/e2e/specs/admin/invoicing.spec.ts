import { expect, test } from '@playwright/test';
import { adminSidebarItem } from '../../utils/adminNav';

const DEFAULT_TIMEOUT = { timeout: 15000 };

test.describe('Invoicing Admin', () => {
  test('navigates to Invoicing tab and loads settings', async ({ page }) => {
    await page.goto('/admin/billing/invoicing');

    await test.step('Invoicing sidebar item is selected', async () => {
      await expect(adminSidebarItem(page, '/admin/billing/invoicing', true)).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Invoicing page heading is visible', async () => {
      await expect(page.getByRole('heading', { name: 'Invoicing', exact: true })).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Invoice Due Days field is visible with a value', async () => {
      const dueDaysInput = page.getByLabel('Invoice Due Days');
      await expect(dueDaysInput).toBeVisible(DEFAULT_TIMEOUT);
      const value = await dueDaysInput.inputValue();
      expect(Number(value)).toBeGreaterThanOrEqual(1);
      expect(Number(value)).toBeLessThanOrEqual(365);
    });

    await test.step('SMS template editor is visible', async () => {
      await expect(page.getByText('Default SMS Message Template')).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Invoice Memo template editor is visible', async () => {
      await expect(page.getByText('Default Invoice Memo Template')).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Save and Reset buttons are visible', async () => {
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Save is disabled and Reset is disabled when form is pristine', async () => {
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });
  });

  test('can switch between Write and Preview tabs on SMS template', async ({ page }) => {
    await page.goto('/admin/billing/invoicing');
    await expect(page.getByText('Default SMS Message Template')).toBeVisible(DEFAULT_TIMEOUT);

    const smsSection = page.getByText('Default SMS Message Template').locator('..');

    await test.step('Write tab is shown by default', async () => {
      const writeTab = smsSection.getByRole('tab', { name: 'Write' });
      await expect(writeTab).toHaveAttribute('aria-selected', 'true', DEFAULT_TIMEOUT);
    });

    await test.step('Switch to Preview tab shows resolved template', async () => {
      await smsSection.getByRole('tab', { name: 'Preview' }).click();
      await expect(smsSection.getByRole('tab', { name: 'Preview' })).toHaveAttribute(
        'aria-selected',
        'true',
        DEFAULT_TIMEOUT
      );
    });

    await test.step('Switch back to Write tab', async () => {
      await smsSection.getByRole('tab', { name: 'Write' }).click();
      await expect(smsSection.getByRole('tab', { name: 'Write' })).toHaveAttribute(
        'aria-selected',
        'true',
        DEFAULT_TIMEOUT
      );
    });
  });

  test('editing Invoice Due Days enables Save and Reset buttons', async ({ page }) => {
    await page.goto('/admin/billing/invoicing');

    const dueDaysInput = page.getByLabel('Invoice Due Days');
    await expect(dueDaysInput).toBeVisible(DEFAULT_TIMEOUT);
    const originalValue = await dueDaysInput.inputValue();

    await test.step('Change due days value', async () => {
      await dueDaysInput.fill('');
      await dueDaysInput.fill('30');
    });

    await test.step('Save and Reset become enabled', async () => {
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled(DEFAULT_TIMEOUT);
      await expect(page.getByRole('button', { name: 'Reset' })).toBeEnabled(DEFAULT_TIMEOUT);
    });

    await test.step('Reset restores the original value', async () => {
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(dueDaysInput).toHaveValue(originalValue, DEFAULT_TIMEOUT);
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });
  });

  test('billing sub-page navigation works from Invoicing', async ({ page }) => {
    await page.goto('/admin/billing/invoicing');
    await expect(adminSidebarItem(page, '/admin/billing/invoicing', true)).toBeVisible(DEFAULT_TIMEOUT);

    await test.step('Switch to Fee Schedules', async () => {
      await adminSidebarItem(page, '/admin/billing/fee-schedules').click();
      await page.waitForURL('**/billing/fee-schedules');
      await expect(adminSidebarItem(page, '/admin/billing/fee-schedules', true)).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Switch back to Invoicing', async () => {
      await adminSidebarItem(page, '/admin/billing/invoicing').click();
      await page.waitForURL('**/billing/invoicing');
      await expect(page.getByRole('heading', { name: 'Invoicing', exact: true })).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('placeholder chips are visible in SMS template Write tab', async ({ page }) => {
    await page.goto('/admin/billing/invoicing');
    await expect(page.getByText('Default SMS Message Template')).toBeVisible(DEFAULT_TIMEOUT);

    await test.step('Placeholder chips are present below the SMS editor', async () => {
      const expectedTokens = [
        '{{patient-full-name}}',
        '{{clinic}}',
        '{{location}}',
        '{{visit-date}}',
        '{{due-date}}',
        '{{amount}}',
        '{{invoice-link}}',
        '{{patient-portal-link}}',
      ];
      for (const token of expectedTokens) {
        await expect(page.getByRole('button', { name: token }).first()).toBeVisible(DEFAULT_TIMEOUT);
      }
    });
  });
});
