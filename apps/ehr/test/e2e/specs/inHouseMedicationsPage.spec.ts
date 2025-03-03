import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { Field, OrderMedicationPage } from '../page/OrderMedicationPage';
import { expectAssessmentPage } from '../page/AssessmentPage';

const resourceHandler = new ResourceHandler('in-person');

const DIAGNOSIS = 'Situs inversus';
const Medication = '0.9% Sodium Chloride IV (1000cc)';

test.beforeEach(async () => {
  await resourceHandler.setResources();
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Open Order Medication screen, check all fields are required', async ({ page }) => {
  const orderMedicationPage = await openOrderMedicationPage(page);
  orderMedicationPage.verifyFillOrderToSaveButtonDisabled();
  await orderMedicationPage.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.MEDICATION);
  await orderMedicationPage.selectAssociatedDx('Select associatedDx');
  await orderMedicationPage.selectMedication('0.9% Sodium Chloride IV (250cc)');
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.ASSOCIATED_DX);
  await orderMedicationPage.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.DOSE);
  await orderMedicationPage.enterDose('2');
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.UNITS);
  await orderMedicationPage.selectUnits('mg');
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.MANUFACTURER);
  await orderMedicationPage.enterManufacturer('Test');
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.ROUTE);
  await orderMedicationPage.selectRoute('Route of administration values');
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.INSTRUCTIONS);
  
});

async function openOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  await page.waitForTimeout(10000);
  const patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  const progressNotePage = await expectProgressNotePage(page);
  await patientInfoPage.sideMenu().clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis(DIAGNOSIS);
  const inHouseMedicationsPage = await progressNotePage.sideMenu().clickInHouseMedications();
  return await inHouseMedicationsPage.clickOrderButton();
}
