import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { AllergiesPage } from '../../page/in-person/AllergiesPage';

const PROCESS_ID = `allergies.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');
const ALLERGY = 'Aspirin';

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

test('ALG-1 Allergies. Happy Path', async ({ page }) => {
  const allergyPage = await prepareAndOpenAllergies(page);
  await test.step('ALG-1.1 Add allergy', async () => {
    await allergyPage.addAllergy(ALLERGY);
  });
  await test.step('ALG-1.2 Check added allergy is shown in In-Person header', async () => {
    await allergyPage.checkAddedAllergyIsShownInHeader(ALLERGY);
  });
  await test.step('ALG-1.3 Verify Progress Note shows Allergy', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyAddedAllergyIsShown(ALLERGY);
  });
  await test.step('ALG-1.4 Open Allergies page and Remove allergy', async () => {
    const sideMenu = new SideMenu(page);
    await sideMenu.clickAllergies();
    await allergyPage.removeAllergy();
  });
  await test.step('ALG-1.5 Check removed allergy is not shown in In-Person header', async () => {
    await allergyPage.checkRemovedAllergyIsNotShownInHeader(ALLERGY);
  });
  await test.step('ALG-1.6 Verify Progress Note does not show removed Allergy', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyRemovedAllergyIsNotShown(ALLERGY);
  });
});

async function prepareAndOpenAllergies(page: Page): Promise<AllergiesPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await inPersonHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  const allergiesPage = await sideMenu.clickAllergies();
  return allergiesPage;
}
