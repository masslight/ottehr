import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { InHouseMedicationsPage } from '../../page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectEditOrderPage, expectOrderMedicationPage } from '../../page/OrderMedicationPage';

const PROCESS_ID = `createAndOrderMedication.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

const DIAGNOSIS = 'Example diagnosis';
const MEDICATION_SEARCH_TERM = 'Example medication';
const DOSE = '1';
const UNITS = 'mg';
const ROUTE = 'Sublingual route';
const INSTRUCTIONS = 'Test instructions';

test.describe.configure({ mode: 'serial' });
let page: Page;
let context: BrowserContext;
let createdMedicationId: string | null = null;
let createdMedicationName: string | null = null;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources();
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  await prepareAppointment(page);
});

test.afterAll(async () => {
  if (createdMedicationId) {
    const oystehr = await ResourceHandler.getOystehr();
    await oystehr.fhir.delete({ resourceType: 'Medication', id: createdMedicationId }).catch((err) => {
      console.warn('Failed to delete created medication during cleanup:', err);
    });
  }
  await resourceHandler.cleanupResources();
  await page.close();
  await context.close();
});

test('Create a new in-house medication via the admin page', async () => {
  await page.goto('/admin/medications/add');
  await page.waitForURL('/admin/medications/add');
  await expect(page.getByRole('heading', { name: 'Add medication' })).toBeVisible();

  // Type in the medication name to trigger the debounced search
  const nameInput = page.getByLabel('Name');
  await nameInput.click();
  await nameInput.fill(MEDICATION_SEARCH_TERM);

  // Wait for the autocomplete options to appear (debounce is 800ms)
  const firstOption = page.getByRole('option').first();
  await firstOption.waitFor({ state: 'visible', timeout: 15000 });

  // Capture the full name of the selected option to use later when ordering
  createdMedicationName = (await firstOption.textContent())?.trim() ?? null;
  await firstOption.click();

  // Submit the form to create the medication
  await page.getByRole('button', { name: 'Create Medication' }).click();

  // Verify redirect to the update/detail page
  await page.waitForURL(new RegExp('/admin/medication/[^/]+$'), { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Update medication' })).toBeVisible();

  // Capture the FHIR resource ID from the URL for cleanup
  const url = page.url();
  const match = url.match(/\/admin\/medication\/([^/]+)$/);
  createdMedicationId = match?.[1] ?? null;

  expect(createdMedicationId).not.toBeNull();
  expect(createdMedicationName).not.toBeNull();
});

test('Order the newly created medication for a patient', async () => {
  if (!createdMedicationName) test.skip();

  await page.goto(`/in-person/${resourceHandler.appointment.id}/in-house-medication/order/new`);
  const orderMedicationPage = await expectOrderMedicationPage(page);

  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();
  await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.editMedicationCard.selectMedication(createdMedicationName!);
  await orderMedicationPage.editMedicationCard.enterDose(DOSE);
  await orderMedicationPage.editMedicationCard.selectUnits(UNITS);
  await orderMedicationPage.editMedicationCard.selectRoute(ROUTE);
  await orderMedicationPage.editMedicationCard.enterInstructions(INSTRUCTIONS);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();
  await orderMedicationPage.editMedicationCard.selectFirstNonEmptyOrderedBy();
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.expectSaved();

  // Navigate back to the MAR and verify the order appears
  const editOrderPage = await expectEditOrderPage(page);
  const medicationsPage: InHouseMedicationsPage = await editOrderPage.clickBackButton();

  await medicationsPage.verifyMedicationPresent({
    medicationName: createdMedicationName!,
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
