import { Page, test } from '@playwright/test';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { expectVisitsPage, openVisitsPage } from '../page/VisitsPage';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

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

  test('Click on "Arrived" button, verify visit is moved to "In office" tab and  visit status is changed to "Arrived" ', async ({ page }) => {
    const visitsPage = await openVisitsPage(page);
    await visitsPage.clickArrivedButton(resourceHandler.appointment.id!);
    await visitsPage.clickInOfficeTab();
    
    });
  