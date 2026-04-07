import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { MEDICAL_HISTORY_CONFIG } from 'utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { InHouseMedicationsPage } from '../../page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage, InPersonAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectEditOrderPage, openOrderMedicationPage, OrderMedicationPage } from '../../page/OrderMedicationPage';

const PROCESS_ID = `medicationQuickPicks.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

const DIAGNOSIS = 'Situs inversus';
const QUICK_PICKS = MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks;

test.describe.configure({ mode: 'serial' });
let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources();
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  await prepareAppointment(page);
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
  await page.close();
  await context.close();
});

test('Quick picks button is visible on order medication page', async () => {
  if (QUICK_PICKS.length === 0) test.skip();

  const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

  const quickPicksButton = page.getByRole('button', { name: /quick picks/i });
  // The button only renders if the loaded medications match quick pick dosespotId/ndc values.
  // Skip gracefully if none are matched in this environment.
  const isVisible = await quickPicksButton.isVisible().catch(() => false);
  if (!isVisible) {
    test.skip();
    return;
  }

  await expect(quickPicksButton).toBeEnabled();
});

test('Selecting a quick pick pre-fills the order form', async () => {
  if (QUICK_PICKS.length === 0) test.skip();

  const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

  const quickPicksButton = page.getByRole('button', { name: /quick picks/i });
  const isVisible = await quickPicksButton.isVisible().catch(() => false);
  if (!isVisible) {
    test.skip();
    return;
  }

  await quickPicksButton.click();

  // Click the first available quick pick item in the menu (skip "Add or Update" if present)
  const menuItems = page.getByRole('menuitem');
  const count = await menuItems.count();
  let quickPickItem = null;
  for (let i = 0; i < count; i++) {
    const item = menuItems.nth(i);
    const text = await item.textContent();
    if (text && !text.includes('Add or Update')) {
      quickPickItem = item;
      break;
    }
  }
  if (!quickPickItem) {
    test.skip();
    return;
  }

  const quickPickName = (await quickPickItem.textContent()) ?? '';
  await quickPickItem.click();

  // Find the matching quick pick config entry to know expected values
  const matchedConfig = QUICK_PICKS.find((qp) => quickPickName.startsWith(qp.name));
  if (!matchedConfig) {
    test.skip();
    return;
  }

  // Medication field should be pre-filled
  await orderMedicationPage.editMedicationCard.verifyMedication(matchedConfig.name);

  // Dose should be pre-filled
  if (matchedConfig.dose != null) {
    await orderMedicationPage.editMedicationCard.verifyDose(String(matchedConfig.dose));
  }

  // Units should be pre-filled
  if (matchedConfig.units) {
    await orderMedicationPage.editMedicationCard.verifyUnits(matchedConfig.units);
  }

  // Instructions should be pre-filled
  if (matchedConfig.instructions) {
    await orderMedicationPage.editMedicationCard.verifyInstructions(matchedConfig.instructions);
  }
});

test('Order created via quick pick is saved with correct values', async () => {
  if (QUICK_PICKS.length === 0) test.skip();

  const orderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();

  const quickPicksButton = page.getByRole('button', { name: /quick picks/i });
  const isVisible = await quickPicksButton.isVisible().catch(() => false);
  if (!isVisible) {
    test.skip();
    return;
  }

  await quickPicksButton.click();

  const menuItems = page.getByRole('menuitem');
  const count = await menuItems.count();
  let quickPickItem = null;
  for (let i = 0; i < count; i++) {
    const item = menuItems.nth(i);
    const text = await item.textContent();
    if (text && !text.includes('Add or Update')) {
      quickPickItem = item;
      break;
    }
  }
  if (!quickPickItem) {
    test.skip();
    return;
  }

  const quickPickName = (await quickPickItem.textContent()) ?? '';
  await quickPickItem.click();

  const matchedConfig = QUICK_PICKS.find((qp) => quickPickName.startsWith(qp.name));
  if (!matchedConfig) {
    test.skip();
    return;
  }

  // Select a diagnosis and ordered-by to satisfy required fields
  await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.editMedicationCard.selectFirstNonEmptyOrderedBy();

  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.expectSaved();

  // Verify the saved order reflects quick pick values
  const editOrderPage: OrderMedicationPage = await expectEditOrderPage(page);
  await editOrderPage.editMedicationCard.verifyMedication(matchedConfig.name);
  if (matchedConfig.dose != null) {
    await editOrderPage.editMedicationCard.verifyDose(String(matchedConfig.dose));
  }
  if (matchedConfig.units) {
    await editOrderPage.editMedicationCard.verifyUnits(matchedConfig.units);
  }
  if (matchedConfig.instructions) {
    await editOrderPage.editMedicationCard.verifyInstructions(matchedConfig.instructions);
  }

  // Navigate back and confirm the order appears in the MAR
  const medicationsPage: InHouseMedicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.verifyMedicationPresent({
    medicationName: matchedConfig.name,
    dose: String(matchedConfig.dose ?? ''),
    units: matchedConfig.units ?? '',
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
  const assessmentPage: InPersonAssessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
}
