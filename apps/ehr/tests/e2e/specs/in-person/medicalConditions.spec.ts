import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { MedicalConditionsPage } from 'tests/e2e/page/MedicalConditionsPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `medicalConditions.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');
const MEDICAL_CONDITION = 'Paratyphoid fever A';

test.beforeAll(async () => {
  if (process.env.INTEGRATION_TEST === 'true') {
    await resourceHandler.setResourcesFast();
  } else {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  }
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test('MC-1 Medical Conditions. Happy Path', async ({ page }) => {
  const medicalConditionsPage = await prepareAndOpenMedicalConditions(page);
  await test.step('MC-1.1 Add Medical Condition', async () => {
    await medicalConditionsPage.addAMedicalCondition(MEDICAL_CONDITION);
  });
  await test.step('MC-1.2 Verify Progress Note shows Medical Condition', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyAddedMedicalConditionIsShown(MEDICAL_CONDITION);
  });
  await test.step('MC-1.3 Open Medical Conditions page and Remove Medical Condition', async () => {
    const sideMenu = new SideMenu(page);
    await sideMenu.clickMedicalConditions();
    await medicalConditionsPage.removeMedicalCondition();
  });
  await test.step('MC-1.4 Verify Progress Note does not show removed Medical Condition', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyRemovedMedicalConditionIsNotShown(MEDICAL_CONDITION);
  });
});

async function prepareAndOpenMedicalConditions(page: Page): Promise<MedicalConditionsPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await inPersonHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  const medicalConditionsPage = await sideMenu.clickMedicalConditions();
  return medicalConditionsPage;
}
