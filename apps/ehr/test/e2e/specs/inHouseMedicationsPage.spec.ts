import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { Field, OrderMedicationPage } from '../page/OrderMedicationPage';
import { expectAssessmentPage } from '../page/AssessmentPage';

const resourceHandler = new ResourceHandler('in-person');

const DIAGNOSIS = 'Situs inversus';
const Medication = '0.9% Sodium Chloride IV (1000cc)';

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test('Open Order Medication screen, check all fields are required', async ({ page }) => {
  const orderMedicationPage = await openOrderMedicationPage(page);
  orderMedicationPage.verifyFillOrderToSaveButtonDisabled();
  await orderMedicationPage.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.MEDICATION);
  await orderMedicationPage.selectAssociatedDx('Select associatedDx');
  
});

async function openOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  await page.waitForTimeout(10000);
  const patientInfoPage = await expectPatientInfoPage(page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  const progressNotePage = await expectProgressNotePage(page);
  await patientInfoPage.sideMenu().clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis(DIAGNOSIS);
  const inHouseMedicationsPage = await progressNotePage.sideMenu().clickInHouseMedications();
  return await inHouseMedicationsPage.clickOrderButton();
}
