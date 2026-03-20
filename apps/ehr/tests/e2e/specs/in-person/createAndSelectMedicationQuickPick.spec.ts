import { BrowserContext, expect, Page, test } from '@playwright/test';
import { ActivityDefinition } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils';
import InHouseMedicationsConfig from '../../../../../../config/oystehr/in-house-medications.json' assert { type: 'json' };
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { InHouseMedicationsPage } from '../../page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import {
  expectEditOrderPage,
  expectOrderMedicationPage,
  openOrderMedicationPage,
} from '../../page/OrderMedicationPage';

const PROCESS_ID = `createAndSelectMedicationQuickPick.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

const DIAGNOSIS = 'Situs inversus';
const DOSE = '5';
const UNITS = 'mg';
const ROUTE = 'Sublingual route';
const INSTRUCTIONS = 'Quick pick test instructions';
// Unique name so cleanup is unambiguous and parallel runs don't collide
const QUICK_PICK_NAME = `E2E Quick Pick ${DateTime.now().toMillis()}`;

function getFirstMedicationName(): string {
  const config = InHouseMedicationsConfig as any;
  const keys = Object.keys(config?.fhirResources || {});
  if (keys.length === 0) throw new Error('No medications found in InHouseMedicationsConfig');
  const identifier = (config.fhirResources[keys[0]].resource.identifier as any[]).find(
    (id) => id.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
  );
  if (!identifier?.value) throw new Error('No name identifier found for first medication');
  return identifier.value;
}

const MEDICATION = getFirstMedicationName();

test.describe.configure({ mode: 'serial' });
let page: Page;
let context: BrowserContext;
let createdQuickPickId: string | null = null;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources();
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  await prepareAppointment(page);
});

test.afterAll(async () => {
  if (createdQuickPickId) {
    const oystehr = await ResourceHandler.getOystehr();
    await oystehr.fhir.delete({ resourceType: 'ActivityDefinition', id: createdQuickPickId }).catch((err) => {
      console.warn('Failed to delete created quick pick during cleanup:', err);
    });
  }
  await resourceHandler.cleanupResources();
  await page.close();
  await context.close();
});

test('Create a new medication quick pick from the order form', async () => {
  const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

  // Fill required fields — these are needed before "Add or Update Quick Pick" is enabled
  await orderMedicationPage.editMedicationCard.selectMedication(MEDICATION);
  await orderMedicationPage.editMedicationCard.enterDose(DOSE);
  await orderMedicationPage.editMedicationCard.selectUnits(UNITS);
  await orderMedicationPage.editMedicationCard.selectRoute(ROUTE);
  await orderMedicationPage.editMedicationCard.enterInstructions(INSTRUCTIONS);

  // Open the Quick Picks dropdown and click "Add or Update Quick Pick"
  const quickPicksButton = page.getByRole('button', { name: /quick picks/i });
  await quickPicksButton.waitFor({ state: 'visible', timeout: 10000 });
  await quickPicksButton.click();

  const addOrUpdateItem = page.getByRole('menuitem', { name: /add or update/i });
  await addOrUpdateItem.waitFor({ state: 'visible' });
  await addOrUpdateItem.click();

  // Verify the dialog is open
  await expect(page.getByTestId(dataTestIds.dialog.title)).toHaveText('Save quick pick');

  // Enter the unique quick pick name
  const nameInput = page.getByLabel('Name');
  await nameInput.fill(QUICK_PICK_NAME);

  // Save the quick pick
  await page.getByTestId(dataTestIds.dialog.proceedButton).click();

  // Dialog should close after successful save
  await expect(page.getByTestId(dataTestIds.dialog.title)).not.toBeVisible({ timeout: 10000 });

  // Fetch the created quick pick ID for cleanup using the Oystehr API
  const oystehr = await ResourceHandler.getOystehr();
  const results = await oystehr.fhir.search<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    params: [{ name: 'title', value: QUICK_PICK_NAME }],
  });
  const quickPick = (results.unbundle() as ActivityDefinition[]).find((r) => r.title === QUICK_PICK_NAME);
  createdQuickPickId = quickPick?.id ?? null;
  expect(createdQuickPickId).not.toBeNull();
});

test('Select the newly created quick pick on the order form', async () => {
  // Open a fresh order form so quick picks are re-fetched from the server
  const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

  // Open the Quick Picks dropdown and select the newly created quick pick
  const quickPicksButton = page.getByRole('button', { name: /quick picks/i });
  await quickPicksButton.waitFor({ state: 'visible', timeout: 10000 });
  await quickPicksButton.click();

  const quickPickItem = page.getByRole('menuitem', { name: new RegExp(QUICK_PICK_NAME) });
  await quickPickItem.waitFor({ state: 'visible', timeout: 10000 });
  await quickPickItem.click();

  // Verify the form is pre-filled with the saved quick pick values
  await orderMedicationPage.editMedicationCard.verifyMedication(MEDICATION);
  await orderMedicationPage.editMedicationCard.verifyDose(DOSE);
  await orderMedicationPage.editMedicationCard.verifyUnits(UNITS);
  await orderMedicationPage.editMedicationCard.verifyInstructions(INSTRUCTIONS);
});

test('Order placed using the quick pick is saved with the correct values', async () => {
  // At this point the form is pre-filled from the previous test step; submit the order
  const orderMedicationPage = await expectOrderMedicationPage(page);

  await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.editMedicationCard.selectFirstNonEmptyOrderedBy();
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.expectSaved();

  // Navigate back to the MAR and verify the order appears with the quick pick values
  const editOrderPage = await expectEditOrderPage(page);
  const medicationsPage: InHouseMedicationsPage = await editOrderPage.clickBackButton();

  await medicationsPage.verifyMedicationPresent({
    medicationName: MEDICATION,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    instructions: INSTRUCTIONS,
    status: 'pending',
  });
});

async function prepareAppointment(page: Page): Promise<void> {
  await page.goto(`/in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  const sideMenu = new SideMenu(page);
  await sideMenu.clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
}
