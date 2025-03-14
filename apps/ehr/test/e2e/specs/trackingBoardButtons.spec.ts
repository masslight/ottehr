import { test } from '@playwright/test';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { openVisitsPage } from '../page/VisitsPage';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectVisitDetailsPage } from '../page/VisitDetailsPage';

const resourceHandler = new ResourceHandler('in-person');

test.beforeEach(async () => {
  await resourceHandler.setResources();
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

test('Check appropriate page is opening on visit click', async ({ page }) => {
  //appointment on pre-booked tab
  let visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickOnVisit(resourceHandler.appointment.id!);
  await page.waitForURL(new RegExp('/visit/' + resourceHandler.appointment.id!));

  // move the appointment to "Waiting Room" section
  visitsPage = await openVisitsPage(page);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickArrivedButton(resourceHandler.appointment.id!);
  await visitsPage.clickInOfficeTab();
  await visitsPage.clickOnVisit(resourceHandler.appointment.id!);
  await page.waitForURL(new RegExp('/visit/' + resourceHandler.appointment.id!));

  // move the appointment to "In Exam Room" section
  visitsPage = await openVisitsPage(page);
  await visitsPage.clickIntakeButton(resourceHandler.appointment.id!);
  let patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);
  visitsPage = await openVisitsPage(page);
  await visitsPage.clickOnVisit(resourceHandler.appointment.id!);
  patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);

  // move the appointment to "Discharged" tab
  await patientInfoPage.cssHeader().changeStatus('completed');
  visitsPage = await openVisitsPage(page);
  await visitsPage.clickDischargedTab();
  await visitsPage.clickOnVisit(resourceHandler.appointment.id!);
  patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);
});

test('Check "Progress note" screen is opened for visits from Cancelled tab', async ({ page }) => {
  let visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickOnVisit(resourceHandler.appointment.id!);
  const visitDetailsPage = await expectVisitDetailsPage(page, resourceHandler.appointment.id!);
  await visitDetailsPage.clickCancelVisitButton();
  await visitDetailsPage.selectCancelationReason('Patient improved');
  await visitDetailsPage.clickCancelButtonFromDialogue();
  visitsPage = await openVisitsPage(page);
  await visitsPage.clickCancelledTab();
  await visitsPage.clickOnVisit(resourceHandler.appointment.id!);
  await page.waitForURL(new RegExp('/visit/' + resourceHandler.appointment.id!));
});
