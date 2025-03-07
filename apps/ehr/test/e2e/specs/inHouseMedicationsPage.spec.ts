import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { expectEditOrderPage, Field, OrderMedicationPage } from '../page/OrderMedicationPage';
import { expectAssessmentPage } from '../page/AssessmentPage';

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
  const editMedicationCard = orderMedicationPage.editMedicationCard();
  await editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.MEDICATION);
  await editMedicationCard.selectAssociatedDx('Select associatedDx');
  await editMedicationCard.selectMedication(MEDICATION);
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.ASSOCIATED_DX);
  await editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.DOSE);
  await editMedicationCard.enterDose('2');
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.UNITS);
  await editMedicationCard.selectUnits('mg');
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.MANUFACTURER);
  await editMedicationCard.enterManufacturer('Test');
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.ROUTE);
  await editMedicationCard.selectRoute('Route of administration values');
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.INSTRUCTIONS);
});

test('Non-selected diagnosis on Assessment page is not present in Order Medication screen on associatedDx dropdown', async ({
  page,
}) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  const editMedicationCard = orderMedicationPage.editMedicationCard();
  await editMedicationCard.verifyDiagnosisNotAllowed('Loiasis');
});

test('Non-numeric values can not be entered into "Dose" field', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  const editMedicationCard = orderMedicationPage.editMedicationCard();
  await editMedicationCard.enterDose('abc1dfg');
  await editMedicationCard.verifyDose('1');
});

test('Order medication, order is submitted successfully and entered data are displayed correctly', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  const editMedicationCard = orderMedicationPage.editMedicationCard();
  await editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await editMedicationCard.selectMedication(MEDICATION);
  await editMedicationCard.enterDose('2');
  await editMedicationCard.selectUnits('mg');
  await editMedicationCard.enterManufacturer('Test');
  await editMedicationCard.selectRoute('Route of administration values');
  await editMedicationCard.enterInstructions('Test instructions');
  await orderMedicationPage.clickOrderMedicationButton();
  
  const editOrderPage = await expectEditOrderPage(page);
  await editMedicationCard.verifyAssociatedDx(DIAGNOSIS);
  await editMedicationCard.verifyMedication(MEDICATION);
  await editMedicationCard.verifyDose('2');
  await editMedicationCard.verifyUnits('mg');
  await editMedicationCard.verifyManufacturer('Test');
  await editMedicationCard.verifyRoute('Route of administration values');
  await editMedicationCard.verifyInstructions('Test instructions');
  
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
