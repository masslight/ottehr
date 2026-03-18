import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { DocumentProcedurePage, openDocumentProcedurePage } from 'tests/e2e/page/DocumentProcedurePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import procedureBodySides from '../../../../../../config/oystehr/procedure-body-sides.json' assert { type: 'json' };
import procedureBodySites from '../../../../../../config/oystehr/procedure-body-sites.json' assert { type: 'json' };
import procedureComplications from '../../../../../../config/oystehr/procedure-complications.json' assert { type: 'json' };
import procedureMedicationsUsed from '../../../../../../config/oystehr/procedure-medications-used.json' assert { type: 'json' };
import procedurePatientResponses from '../../../../../../config/oystehr/procedure-patient-responses.json' assert { type: 'json' };
import procedurePostInstructions from '../../../../../../config/oystehr/procedure-post-instructions.json' assert { type: 'json' };
import procedureSupplies from '../../../../../../config/oystehr/procedure-supplies.json' assert { type: 'json' };
import procedureTechniques from '../../../../../../config/oystehr/procedure-techniques.json' assert { type: 'json' };
import procedureTimeSpent from '../../../../../../config/oystehr/procedure-time-spent.json' assert { type: 'json' };
import procedureType from '../../../../../../config/oystehr/procedure-type.json' assert { type: 'json' };

const DEFAULT_TIMEOUT = { timeout: 15000 };
const PROCESS_ID = `procedure-quick-picks-${DateTime.now().toMillis()}`;
const QUICK_PICK_NAME = `E2E Test Quick Pick ${PROCESS_ID}`;

const PROCEDURE_TYPE_CODINGS = Object.entries(procedureType.fhirResources).find(([key]) =>
  key.startsWith('value-set-procedure-type')
)?.[1].resource.expansion.contains;
const FIRST_PROCEDURE_TYPE = PROCEDURE_TYPE_CODINGS![0].display;

const BODY_SITES = procedureBodySites.fhirResources['value-set-procedure-body-sites'].resource.expansion.contains;
const BODY_SIDES = procedureBodySides.fhirResources['value-set-procedure-body-sides'].resource.expansion.contains;
const TECHNIQUES = procedureTechniques.fhirResources['value-set-procedure-techniques'].resource.expansion.contains;
const SUPPLIES = procedureSupplies.fhirResources['value-set-procedure-supplies'].resource.expansion.contains;
const MEDICATIONS_USED =
  procedureMedicationsUsed.fhirResources['value-set-procedure-medications-used'].resource.expansion.contains;
const COMPLICATIONS =
  procedureComplications.fhirResources['value-set-procedure-complications'].resource.expansion.contains;
const PATIENT_RESPONSES =
  procedurePatientResponses.fhirResources['value-set-procedure-patient-responses'].resource.expansion.contains;
const POST_INSTRUCTIONS =
  procedurePostInstructions.fhirResources['value-set-procedure-post-instructions'].resource.expansion.contains;
const TIME_SPENT = procedureTimeSpent.fhirResources['value-set-procedure-time-spent'].resource.expansion.contains;

async function fillProcedureForm(documentProcedurePage: DocumentProcedurePage): Promise<void> {
  await documentProcedurePage.setConsentForProcedureChecked(true);
  await documentProcedurePage.selectProcedureType(FIRST_PROCEDURE_TYPE);
  await documentProcedurePage.selectCptCode('73000');
  await documentProcedurePage.selectDiagnosis('D51.0');
  await documentProcedurePage.selectPerformedBy('Healthcare staff');
  await documentProcedurePage.selectAnaesthesia(MEDICATIONS_USED[0].display);
  await documentProcedurePage.selectSite(BODY_SITES[0].display);
  await documentProcedurePage.selectSideOfBody(BODY_SIDES[0].display);
  await documentProcedurePage.selectTechnique([TECHNIQUES[0].display]);
  await documentProcedurePage.selectInstruments([SUPPLIES[0].display]);
  await documentProcedurePage.enterProcedureDetails('E2E quick pick test - detailed procedure notes');
  await documentProcedurePage.selectSpecimenSent('Yes');
  await documentProcedurePage.selectComplications(COMPLICATIONS[1].display);
  await documentProcedurePage.selectPatientResponse(PATIENT_RESPONSES[0].display);
  await documentProcedurePage.selectPostProcedureInstructions([POST_INSTRUCTIONS[0].display]);
  await documentProcedurePage.selectTimeSpent(TIME_SPENT[0].display);
  await documentProcedurePage.selectDocumentedBy('Provider');
}

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
    await test.step('Navigate to Document Procedure page and fill in all fields', async () => {
      const documentProcedurePage = await openDocumentProcedurePage(resourceHandler.appointment.id!, page);
      await fillProcedureForm(documentProcedurePage);
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

      // Type the quick pick name in the autocomplete and close the dropdown
      const nameInput = dialog.locator('input').first();
      await nameInput.fill(QUICK_PICK_NAME);
      await page.keyboard.press('Escape');

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

    await test.step('Verify quick pick appears in charting experience', async () => {
      // Navigate to a new procedure form on the same appointment
      await openDocumentProcedurePage(resourceHandler.appointment.id!, page);

      // Open the Quick Picks menu
      const quickPicksButton = page.getByRole('button', { name: /Quick Picks/i });
      await expect(quickPicksButton).toBeVisible(DEFAULT_TIMEOUT);
      await quickPicksButton.click();

      // Verify the quick pick we created appears in the dropdown
      const quickPickMenuItem = page.getByRole('menuitem', { name: QUICK_PICK_NAME });
      await expect(quickPickMenuItem).toBeVisible(DEFAULT_TIMEOUT);

      // Close the menu
      await page.keyboard.press('Escape');
    });

    await test.step('Delete the quick pick from admin', async () => {
      // Find the row with our quick pick and click the Remove button
      const row = page.locator('tr', { hasText: QUICK_PICK_NAME });
      await expect(row).toBeVisible(DEFAULT_TIMEOUT);

      // Accept the window.confirm dialog that appears when clicking Remove
      page.on('dialog', (dialog) => dialog.accept());

      const removeButton = row.getByRole('button', { name: /remove/i });
      await removeButton.click();

      // Wait for success snackbar
      const snackbar = page.locator('div[id=notistack-snackbar]');
      await expect(snackbar).toBeVisible(DEFAULT_TIMEOUT);
      await expect(snackbar).toContainText('removed');

      // Verify quick pick is gone
      await expect(page.getByText(QUICK_PICK_NAME)).not.toBeVisible({ timeout: 5000 });
    });
  });
});
