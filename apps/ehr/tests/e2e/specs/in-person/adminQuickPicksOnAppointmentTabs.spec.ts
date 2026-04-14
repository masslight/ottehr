import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `adminQuickPicksOnTabs-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

const DEFAULT_TIMEOUT = { timeout: 15000 };
const SEARCH_TIMEOUT = { timeout: 25000 };

const ALLERGY_SEARCH_TERM = 'Tetracycline';
const MEDICAL_CONDITION_SEARCH_TERM = 'J06';

test.describe('Admin-added quick picks are visible and usable on appointment tabs', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  let addedAllergyName: string | undefined;
  let addedMedicalConditionDisplay: string | undefined;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();

    await openVisit(page);
  });

  test.afterAll(async () => {
    try {
      await page.goto('/admin/quick-picks');
      await expect(page.getByRole('tab', { name: 'Allergies' })).toBeVisible({ timeout: 10000 });

      if (addedAllergyName) {
        await page.getByRole('tab', { name: 'Allergies' }).click();
        const allergyRow = page.locator('tr', { hasText: addedAllergyName });
        if (await allergyRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          page.on('dialog', (dialog) => dialog.accept());
          await allergyRow.getByTitle('Remove').click();
          await page
            .locator('div[id=notistack-snackbar]')
            .waitFor({ state: 'visible', timeout: 5000 })
            .catch(() => {});
        }
      }

      if (addedMedicalConditionDisplay) {
        await page.getByRole('tab', { name: 'Medical Conditions' }).click();
        const conditionRow = page.locator('tr', { hasText: addedMedicalConditionDisplay });
        if (await conditionRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          page.on('dialog', (dialog) => dialog.accept());
          await conditionRow.getByTitle('Remove').click();
          await page
            .locator('div[id=notistack-snackbar]')
            .waitFor({ state: 'visible', timeout: 5000 })
            .catch(() => {});
        }
      }
    } catch {
      // Cleanup failures should not fail the test run.
    }

    await page.close();
    await context.close();
    await resourceHandler.cleanupResources();
  });

  test('Quick picks button is visible on allergies tab when quick picks are configured', async () => {
    await page.goto('/admin/quick-picks');
    await expect(page.getByRole('tab', { name: 'Allergies' })).toBeVisible(DEFAULT_TIMEOUT);
    await page.getByRole('tab', { name: 'Allergies' }).click();

    const hasNoQuickPicks = await page
      .locator('table, p:has-text("No quick picks configured yet.")')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasNoQuickPicks) {
      test.skip();
      return;
    }

    await page.goto(`/in-person/${resourceHandler.appointment.id}/allergies`);
    await page.waitForURL(new RegExp('/in-person/.*/allergies'));

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
  });

  test('allergy quick pick added from admin page appears in the Quick Picks menu on the allergies tab', async () => {
    await page.goto('/admin/quick-picks');
    await expect(page.getByRole('tab', { name: 'Allergies' })).toBeVisible(DEFAULT_TIMEOUT);
    await page.getByRole('tab', { name: 'Allergies' }).click();

    const existingAllergyRow = page.locator('tr').filter({ hasText: ALLERGY_SEARCH_TERM });
    if (await existingAllergyRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    const addButton = page.getByRole('button', { name: /^add$/i });
    await expect(addButton).toBeVisible(DEFAULT_TIMEOUT);
    await addButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

    const searchInput = dialog.locator('input').first();
    await searchInput.fill(ALLERGY_SEARCH_TERM);
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible(SEARCH_TIMEOUT);

    const firstOption = listbox.getByRole('option').first();
    await expect(firstOption).toBeVisible(DEFAULT_TIMEOUT);
    addedAllergyName = (await firstOption.textContent()) ?? ALLERGY_SEARCH_TERM;
    await firstOption.click();

    await dialog.getByRole('button', { name: /^add$/i }).click();

    const snackbar = page.locator('div[id=notistack-snackbar]');
    await expect(snackbar).toBeVisible(DEFAULT_TIMEOUT);
    await expect(snackbar).toContainText('created');

    await expect(page.getByRole('cell', { name: addedAllergyName, exact: false })).toBeVisible(DEFAULT_TIMEOUT);

    await page.goto(`/in-person/${resourceHandler.appointment.id}/allergies`);
    await page.waitForURL(new RegExp('/in-person/.*/allergies'));

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
    await quickPicksButton.click();

    await expect(page.getByRole('menuitem', { name: addedAllergyName, exact: false })).toBeVisible(DEFAULT_TIMEOUT);
  });

  test('selecting an admin-added allergy quick pick adds it to the allergies list', async () => {
    if (!addedAllergyName) {
      test.skip();
      return;
    }

    await page.goto(`/in-person/${resourceHandler.appointment.id}/allergies`);
    await page.waitForURL(new RegExp('/in-person/.*/allergies'));

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
    await quickPicksButton.click();

    const menuItem = page.getByRole('menuitem', { name: addedAllergyName, exact: false });
    await expect(menuItem).toBeVisible(DEFAULT_TIMEOUT);
    await menuItem.click();

    const allergiesList = page.getByTestId(dataTestIds.allergies.knownAllergiesList);
    await expect(allergiesList).toBeVisible(DEFAULT_TIMEOUT);
    await expect(allergiesList).toContainText(addedAllergyName);
  });

  test('medical condition quick pick added from admin page appears in the Quick Picks menu on the medical conditions tab', async () => {
    await page.goto('/admin/quick-picks');
    await expect(page.getByRole('tab', { name: 'Medical Conditions' })).toBeVisible(DEFAULT_TIMEOUT);
    await page.getByRole('tab', { name: 'Medical Conditions' }).click();

    const existingCodeCell = page.locator('td').filter({ hasText: new RegExp(`^${MEDICAL_CONDITION_SEARCH_TERM}`) });
    if (await existingCodeCell.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    const addButton = page.getByRole('button', { name: /^add$/i });
    await expect(addButton).toBeVisible(DEFAULT_TIMEOUT);
    await addButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

    const searchInput = dialog.locator('input').first();
    await searchInput.fill(MEDICAL_CONDITION_SEARCH_TERM);
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible(SEARCH_TIMEOUT);

    const firstOption = listbox.getByRole('option').first();
    await expect(firstOption).toBeVisible(DEFAULT_TIMEOUT);

    const optionText = (await firstOption.textContent()) ?? '';
    const parts = optionText.trim().split(' ');
    addedMedicalConditionDisplay = parts.length > 1 ? parts.slice(1).join(' ') : optionText.trim();

    await firstOption.click();

    await dialog.getByRole('button', { name: /^add$/i }).click();

    const snackbar = page.locator('div[id=notistack-snackbar]');
    await expect(snackbar).toBeVisible(DEFAULT_TIMEOUT);
    await expect(snackbar).toContainText('created');

    await expect(page.getByRole('cell', { name: addedMedicalConditionDisplay, exact: false })).toBeVisible(
      DEFAULT_TIMEOUT
    );

    await page.goto(`/in-person/${resourceHandler.appointment.id}/medical-conditions`);
    await page.waitForURL(new RegExp('/in-person/.*/medical-conditions'));

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
    await quickPicksButton.click();

    await expect(page.getByRole('menuitem', { name: addedMedicalConditionDisplay, exact: false })).toBeVisible(
      DEFAULT_TIMEOUT
    );
  });

  test('selecting an admin-added medical condition quick pick adds it to the medical conditions list', async () => {
    if (!addedMedicalConditionDisplay) {
      test.skip();
      return;
    }

    await page.goto(`/in-person/${resourceHandler.appointment.id}/medical-conditions`);
    await page.waitForURL(new RegExp('/in-person/.*/medical-conditions'));

    const quickPicksButton = page.getByRole('button', { name: 'Quick Picks' });
    await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
    await quickPicksButton.click();

    const menuItem = page.getByRole('menuitem', { name: addedMedicalConditionDisplay, exact: false });
    await expect(menuItem).toBeVisible(DEFAULT_TIMEOUT);
    await menuItem.click();

    const conditionsList = page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList);
    await expect(conditionsList).toBeVisible(DEFAULT_TIMEOUT);
    await expect(conditionsList).toContainText(addedMedicalConditionDisplay);
  });
});

async function openVisit(page: Page): Promise<void> {
  await page.goto(`/in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
}
