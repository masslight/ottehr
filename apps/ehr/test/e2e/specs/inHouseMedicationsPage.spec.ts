import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { expectEditOrderPage, Field, OrderMedicationPage } from '../page/OrderMedicationPage';
import { expectAssessmentPage } from '../page/AssessmentPage';
import { openInHouseMedicationsPage } from '../page/InHouseMedicationsPage';

const resourceHandler = new ResourceHandler('in-person');

const DIAGNOSIS = 'Situs inversus';
const MEDICATION = '0.9% Sodium Chloride IV (1000cc)';

test.beforeEach(async () => {
  await resourceHandler.setResources();
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Open Order Medication screen, check all fields are required', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  orderMedicationPage.verifyFillOrderToSaveButtonDisabled();
  await orderMedicationPage.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.verifyValidationErrorShown(Field.MEDICATION);
  await orderMedicationPage.selectAssociatedDx('Select associatedDx');
  await orderMedicationPage.selectMedication(MEDICATION);
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

test('Non-selected diagnosis on Assessment page is not present in Order Medication screen on associatedDx dropdown', async ({
  page,
}) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.verifyDiagnosisNotAllowed('Loiasis');
});

test('Non-numeric values can not be entered into "Dose" field', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.enterDose('abc1dfg');
  await orderMedicationPage.verifyDose('1');
});

test('Order medication, order is submitted successfully and entered data are displayed correctly', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.selectMedication(MEDICATION);
  await orderMedicationPage.enterDose('2');
  await orderMedicationPage.selectUnits('mg');
  await orderMedicationPage.enterManufacturer('Test');
  await orderMedicationPage.selectRoute('Route of administration values');
  await orderMedicationPage.enterInstructions('Test instructions');
  await orderMedicationPage.clickOrderMedicationButton();
  
  const editOrderPage = await expectEditOrderPage(page);
  await editOrderPage.verifyAssociatedDx(DIAGNOSIS);
  await editOrderPage.verifyMedication(MEDICATION);
  await editOrderPage.verifyDose('2');
  await editOrderPage.verifyUnits('mg');
  await editOrderPage.verifyManufacturer('Test');
  await editOrderPage.verifyRoute('Route of administration values');
  await editOrderPage.verifyInstructions('Test instructions');
  
  const medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.verifyMedicationPresent(MEDICATION , 'pending');
});

async function prepareAndOpenOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
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
