import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { CssHeader } from 'tests/e2e/page/CssHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { OrderInHouseLabPage } from '../../page/OrderInHouseLabPage';

const PROCESS_ID = `inHouseLabsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

// cSpell:disable-next inversus
const TEST_TYPE = 'Flu A';

test.beforeEach(async () => {
  if (process.env.INTEGRATION_TEST === 'true') {
    await resourceHandler.setResourcesFast();
  } else {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  }
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Open Order In House lab screen', async ({ page }) => {
  const orderInHouseLabPage = await prepareAndOpenInHouseLabsPage(page);
  await orderInHouseLabPage.verifyOrderAndPrintLabeButtonDisabled();
  await orderInHouseLabPage.verifyOrderInHouseLabButtonDisabled();
  await orderInHouseLabPage.selectTestType(TEST_TYPE);
});

async function prepareAndOpenInHouseLabsPage(page: Page): Promise<OrderInHouseLabPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const cssHeader = new CssHeader(page);
  await cssHeader.selectIntakePractitioner();
  await cssHeader.selectProviderPractitioner();
  await cssHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  const inHouseLabsPage = await sideMenu.clickInHouseLabs();
  return await inHouseLabsPage.clickOrderButton();
}
