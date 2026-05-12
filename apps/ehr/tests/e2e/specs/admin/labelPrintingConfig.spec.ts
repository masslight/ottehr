import { BrowserContext, expect, Page, test } from '@playwright/test';
import { LabelPrintingConfigAdminPage } from '../../page/LabelPrintingConfigAdminPage';

const DEFAULT_TIMEOUT = { timeout: 30_000 };

// These tests run serially because they mutate a shared FHIR Device resource.
// afterAll restores the environment to manual mode.
test.describe('Label Printing Config admin', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  let context: BrowserContext;
  let configPage: LabelPrintingConfigAdminPage;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    configPage = new LabelPrintingConfigAdminPage(page);
  });

  test.afterAll(async () => {
    // Restore the environment to manual mode so other test runs start from a clean state.
    await configPage.goto();
    await configPage.waitForFormLoaded();
    await configPage.selectMode('manual');
    await configPage.submitAndWaitForSuccess();
    await page.close();
    await context.close();
  });

  test('Label Printing Config tab is visible on the Admin page', async () => {
    await page.goto('admin/schedules');
    await expect(page.getByRole('tab', { name: 'Label Printing Config' })).toBeVisible(DEFAULT_TIMEOUT);
  });

  test('manual mode flow: save, reload, verify', async () => {
    await test.step('navigate to the label printing config tab', async () => {
      await configPage.goto();
      await configPage.waitForFormLoaded();
    });

    await test.step('form shows manual mode on load', async () => {
      await configPage.expectModeIs('manual');
      await configPage.expectIntegratedFieldsNotVisible();
    });

    await test.step('save manual mode', async () => {
      await configPage.submitAndWaitForSuccess();
    });

    await test.step('reload and verify manual mode is still displayed', async () => {
      await configPage.reload();
      await configPage.expectModeIs('manual');
      await configPage.expectIntegratedFieldsNotVisible();
    });
  });

  test('integrated mode flow: fill, save, reload, verify', async () => {
    await test.step('navigate to the label printing config tab', async () => {
      await configPage.goto();
      await configPage.waitForFormLoaded();
    });

    await test.step('switch to integrated mode and verify additional fields appear', async () => {
      await configPage.selectMode('integrated');
      await configPage.expectIntegratedFieldsVisible();
    });

    await test.step('fill out the integrated config fields', async () => {
      await configPage.selectManufacturer('DYMO');
      await configPage.selectLabelType('30334');
      await configPage.selectOrientation('portrait');
    });

    await test.step('save the integrated config', async () => {
      await configPage.submitAndWaitForSuccess();
    });

    await test.step('reload and verify integrated mode is displayed with the saved values', async () => {
      await configPage.reload();
      await configPage.expectModeIs('integrated');
      await configPage.expectIntegratedFieldsVisible();
      await configPage.expectManufacturerIs('DYMO');
      await configPage.expectLabelTypeIs('30334');
      await configPage.expectOrientationIs('portrait');
    });
  });
});
