import { test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { CssHeader } from '../page/CssHeader';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { openVisitsPage } from '../page/VisitsPage';

const PROCESS_ID = `trackingBoardButtons.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

test.beforeEach(async () => {
  if (process.env.INTEGRATION_TEST === 'true') {
    await resourceHandler.setResourcesFast();
  } else {
    await resourceHandler.setResources();
  }
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Clicking on "Add patient" button  opens "Add patient" page ', async ({ page }) => {
  const visitsPage = await openVisitsPage(page);
  await visitsPage.clickAddPatientButton();
  await expectAddPatientPage(page);
});

test('Click on "Arrived" button, verify visit is moved to "In office" tab and  visit status is changed to "Arrived" ', async ({
  page,
}) => {
  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickArrivedButton(resourceHandler.appointment.id!);
  await visitsPage.clickInOfficeTab();
  await visitsPage.verifyVisitsStatus(resourceHandler.appointment.id!, 'arrived');
});

test('Check clicks on appointment row elements', async ({ page }) => {
  let visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickOnPatientName(resourceHandler.appointment.id!);
  await page.waitForURL(new RegExp('/patient/' + resourceHandler.patient.id));

  visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickVisitDetailsButton(resourceHandler.appointment.id!);
  await page.waitForURL(new RegExp('/visit/' + resourceHandler.appointment.id!));

  visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickArrivedButton(resourceHandler.appointment.id!);
  await visitsPage.clickInOfficeTab();
  await visitsPage.clickIntakeButton(resourceHandler.appointment.id!);
  const cssHeader = new CssHeader(page);
  await cssHeader.selectIntakePractitioner();
  await cssHeader.selectProviderPractitioner();
  const patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);
  await patientInfoPage.cssHeader().changeStatus('completed');

  visitsPage = await openVisitsPage(page);
  await visitsPage.clickDischargedTab();
  await visitsPage.clickProgressNoteButton(resourceHandler.appointment.id!);
  await page.waitForURL(new RegExp(`/in-person/${resourceHandler.appointment.id!}/progress-note`), { timeout: 10000 });
});
