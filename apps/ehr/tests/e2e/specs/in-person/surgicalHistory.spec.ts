import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { SurgicalHistoryPage } from 'tests/e2e/page/SurgicalHistoryPage';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
const PROCESS_ID = `surgicalHistory.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

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

test('SH-1 Surgical History. Happy Path', async ({ page }) => {
  let SURGERY: string;
  const surgicalHistoryPage = await prepareAndOpenSurgicalHistory(page);
  await test.step('SH-1.1 Add Surgery', async () => {
    SURGERY = await surgicalHistoryPage.addSurgery();
  });
  await test.step('SH-1.2 Verify Progress Note shows surgeries', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyAddedSurgeryIsShown(SURGERY);
  });
  await test.step('SH-1.3 Remove Surgery', async () => {
    const sideMenu = new SideMenu(page);
    await sideMenu.clickSurgicalHistory();
    await surgicalHistoryPage.removeSurgery();
  });
  await test.step('SH-1.4 Verify Progress Note does not show removed surgery', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyRemovedSurgeryIsNotShown(SURGERY);
  });
});

async function prepareAndOpenSurgicalHistory(page: Page): Promise<SurgicalHistoryPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await inPersonHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  const surgicalHistoryPage = await sideMenu.clickSurgicalHistory();
  return surgicalHistoryPage;
}
