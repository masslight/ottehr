import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { CssHeader } from 'tests/e2e/page/CssHeader';
import { FinalResultPage } from 'tests/e2e/page/FinalResultPage';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
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
const TEST_RESULT_DETECTED = 'Detected';
const SECTION_TITLE = 'In-House Labs';
const STATUS = {
  ORDERED: 'ORDERED',
  COLLECTED: 'COLLECTED',
  FINAL: 'FINAL',
};

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

test('IHL-1 In-house labs. Happy Path', async ({ page }) => {
  await test.step('IHL-1.1 Open In-house Labs and place order', async () => {
    const orderInHouseLabPage = await prepareAndOpenInHouseLabsPage(page);
    await orderInHouseLabPage.verifyOrderAndPrintLabeButtonDisabled();
    await orderInHouseLabPage.verifyOrderInHouseLabButtonDisabled();
    await orderInHouseLabPage.selectTestType(TEST_TYPE);
    await orderInHouseLabPage.verifyCPTCode(CPT_CODE);
    await orderInHouseLabPage.verifyOrderInHouseLabButtonEnabled();
    await orderInHouseLabPage.verifyOrderAndPrintLabelButtonEnabled();
    await orderInHouseLabPage.clickOrderInHouseLabButton();
  });

  await test.step('IHL-1.2 Collect sample', async () => {
    const orderDetailsPage = await expectOrderDetailsPage(page);
    await orderDetailsPage.collectSamplePage.verifyTestName(TEST_TYPE);
    await orderDetailsPage.collectSamplePage.verifyMarkAsCollectedButtonDisabled();
    await orderDetailsPage.collectSamplePage.verifyStatus(STATUS.ORDERED);
    await orderDetailsPage.collectSamplePage.fillSource(SOURCE);
    await orderDetailsPage.collectSamplePage.clickMarkAsCollected();
  });

  await test.step('IHL-1.3 Perform test and submit result', async () => {
    const performTestPage = new PerformTestPage(page);
    await performTestPage.verifyPerformTestPageOpened();
    await performTestPage.verifyStatus(STATUS.COLLECTED);
    await performTestPage.verifySubmitButtonDisabled();
    await performTestPage.selectTestResult(TEST_RESULT_DETECTED);
    await performTestPage.verifySubmitButtonEnabled();
    await performTestPage.submitOrderResult();
  });

  await test.step('IHL-1.4 Verify final result & PDF', async () => {
    const finalResultPage = new FinalResultPage(page);
    await finalResultPage.verifyStatus(STATUS.FINAL);
    await finalResultPage.verifyTestResult(TEST_RESULT_DETECTED);
    await finalResultPage.verifyResultsPDFButtonEnabled();
    await finalResultPage.verifyResultsPdfOpensInNewTab();
  });

  await test.step('IHL-1.5 Verify Progress Note shows IHL entry', async () => {
    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyInHouseLabs(SECTION_TITLE, TEST_TYPE);
  });
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
