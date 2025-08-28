import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { CssHeader } from 'tests/e2e/page/CssHeader';
import { PerformTestPage } from 'tests/e2e/page/PerformTestPage';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectOrderDetailsPage, OrderInHouseLabPage } from '../../page/OrderInHouseLabPage';

const PROCESS_ID = `inHouseLabsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

const TEST_TYPE = 'Flu A';
const CPT_CODE = '87501';
const DIAGNOSIS = 'Situs inversus';
const SOURCE = 'Nasopharyngeal swab';
const STATUS_ORDERED = 'Ordered';
const STATUS_COLLECTED = 'Collected';

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

test('Order In-house Lab', async ({ page }) => {
  const orderInHouseLabPage = await prepareAndOpenInHouseLabsPage(page);
  await orderInHouseLabPage.verifyOrderAndPrintLabeButtonDisabled();
  await orderInHouseLabPage.verifyOrderInHouseLabButtonDisabled();
  await orderInHouseLabPage.selectTestType(TEST_TYPE);
  await orderInHouseLabPage.verifyCPTCode(CPT_CODE);
  await orderInHouseLabPage.verifyOrderInHouseLabButtonEnabled();
  await orderInHouseLabPage.verifyOrderAndPrintLabelButtonEnabled();
  await orderInHouseLabPage.clickOrderInHouseLabButton();
  const orderDetailsPage = await expectOrderDetailsPage(page);
  await orderDetailsPage.collectSamplePage.verifyTestName(TEST_TYPE);
  await orderDetailsPage.collectSamplePage.verifyMarkAsCollectedButtonDisabled();
  await orderDetailsPage.collectSamplePage.verifyStatus(STATUS_ORDERED);
  await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
  await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
  const performTestPage = new PerformTestPage(page);
  await performTestPage.verifyPerformTestPageOpened();
  await performTestPage.verifyStatus(STATUS_COLLECTED);
  await performTestPage.verifySubmitButtonDisabled();
});

async function prepareAndOpenInHouseLabsPage(page: Page): Promise<OrderInHouseLabPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const cssHeader = new CssHeader(page);
  await cssHeader.selectIntakePractitioner();
  await cssHeader.selectProviderPractitioner();
  await cssHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  await sideMenu.clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
  const inHouseLabsPage = await sideMenu.clickInHouseLabs();
  return await inHouseLabsPage.clickOrderButton();
}
