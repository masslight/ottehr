import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { openDocumentProcedurePage } from 'tests/e2e/page/DocumentProcedurePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import procedureType from '../../../../../../config/oystehr/procedure-type.json' assert { type: 'json' };

const DEFAULT_TIMEOUT = { timeout: 15000 };
const PROCESS_ID = `procedure-quick-picks-${DateTime.now().toMillis()}`;
const QUICK_PICK_NAME = `E2E Test Quick Pick ${PROCESS_ID}`;

const PROCEDURE_TYPE_CODINGS = Object.entries(procedureType.fhirResources).find(([key]) =>
  key.startsWith('value-set-procedure-type')
)?.[1].resource.expansion.contains;
const FIRST_PROCEDURE_TYPE = PROCEDURE_TYPE_CODINGS![0].display;

const resourceHandler = new ResourceHandler(PROCESS_ID);

let context: BrowserContext;
let page: Page;

async function setupPractitioners(page: Page): Promise<void> {
  const inPersonHeader = new InPersonHeader(page);
  await page.goto(`in-person/${resourceHandler.appointment.id}/review-and-sign`);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
}

test.beforeAll(async ({ browser }) => {
  await resourceHandler.setResources({ skipPaperwork: true });
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

  context = await browser.newContext();
  page = await context.newPage();

  await setupPractitioners(page);
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  await resourceHandler.cleanupResources();
});

test.describe.configure({ mode: 'serial' });

test.describe('Procedure Quick Picks E2E', () => {
  test('Create a quick pick from procedure form, verify in admin, then delete', async () => {
    await test.step('Navigate to Document Procedure page and fill in procedure type', async () => {
      const documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
      await documentProcedurePage.selectProcedureType(FIRST_PROCEDURE_TYPE);
      await documentProcedurePage.enterProcedureDetails('E2E test procedure details');
    });

    await test.step('Open Quick Picks menu and click Add or Update Quick Pick', async () => {
      const quickPicksButton = page.getByRole('button', { name: /Quick Picks/i });
      await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
      await quickPicksButton.click();

      const addOption = page.getByRole('menuitem', { name: /Add or Update Quick Pick/i });
      await expect(addOption).toBeVisible(DEFAULT_TIMEOUT);
      await addOption.click();
    });

    await test.step('Enter quick pick name and save', async () => {
      // Wait for the dialog to open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

      // Type the quick pick name in the autocomplete
      const nameInput = dialog.locator('input').first();
      await nameInput.fill(QUICK_PICK_NAME);

      // Click Save
      const saveButton = dialog.getByRole('button', { name: /Save/i });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Wait for success snackbar
      const snackbar = page.locator('div[id=notistack-snackbar]');
      await expect(snackbar).toBeVisible(DEFAULT_TIMEOUT);
      await expect(snackbar).toContainText('created');
    });

    await test.step('Navigate to admin and verify quick pick exists', async () => {
      await page.goto('/telemed-admin/quick-picks');
      await expect(page.getByRole('tab', { name: 'Procedures' })).toBeVisible(DEFAULT_TIMEOUT);

      // Procedures tab should be selected by default
      await expect(page.getByRole('tab', { name: 'Procedures' })).toHaveAttribute('aria-selected', 'true');

      // Wait for content to load and verify our quick pick appears
      await expect(page.getByText(QUICK_PICK_NAME)).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Delete the quick pick from admin', async () => {
      // Find the row with our quick pick and click delete
      const row = page.locator('tr', { hasText: QUICK_PICK_NAME });
      await expect(row).toBeVisible(DEFAULT_TIMEOUT);

      const deleteButton = row.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      // Confirm deletion in the dialog
      const confirmButton = page.getByRole('button', { name: /delete/i }).last();
      await confirmButton.click();

      // Wait for success snackbar
      const snackbar = page.locator('div[id=notistack-snackbar]');
      await expect(snackbar).toBeVisible(DEFAULT_TIMEOUT);
      await expect(snackbar).toContainText('removed');

      // Verify quick pick is gone
      await expect(page.getByText(QUICK_PICK_NAME)).not.toBeVisible({ timeout: 5000 });
    });
  });
});
