import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { expectEditOrderPage, OrderMedicationPage } from '../page/OrderMedicationPage';
import { expectAssessmentPage } from '../page/AssessmentPage';
import { Field } from '../page/EditMedicationCard';

const resourceHandler = new ResourceHandler('in-person');

const DIAGNOSIS = 'Situs inversus';
const MEDICATION = '0.9% Sodium Chloride IV (1000cc)';
const DOSE = '2';
const UNITS = 'mg';
const MANUFACTURER ='Test';
const ROUTE = 'Route of administration values';
const INSTRUCTIONS = 'INSTRUCTIONS';

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
  await editMedicationCard.enterDose(DOSE);
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.UNITS);
  await editMedicationCard.selectUnits(UNITS);
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.MANUFACTURER);
  await editMedicationCard.enterManufacturer(MANUFACTURER);
  await orderMedicationPage.clickOrderMedicationButton();
  await editMedicationCard.verifyValidationErrorShown(Field.ROUTE);
  await editMedicationCard.selectRoute(ROUTE);
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
  await editMedicationCard.enterDose(DOSE);
  await editMedicationCard.selectUnits(UNITS);
  await editMedicationCard.enterManufacturer(MANUFACTURER);
  await editMedicationCard.selectRoute(ROUTE);
  await editMedicationCard.enterInstructions(INSTRUCTIONS);
  await orderMedicationPage.clickOrderMedicationButton();
  
  const editOrderPage = await expectEditOrderPage(page);
  await editMedicationCard.verifyAssociatedDx(DIAGNOSIS);
  await editMedicationCard.verifyMedication(MEDICATION);
  await editMedicationCard.verifyDose(DOSE);
  await editMedicationCard.verifyUnits(UNITS);
  await editMedicationCard.verifyManufacturer(MANUFACTURER);
  await editMedicationCard.verifyRoute(ROUTE);
  await editMedicationCard.verifyInstructions(INSTRUCTIONS);
  
  const medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.verifyMedicationPresent(MEDICATION , 'pending');

  await medicationsPage.clickMedicationDetailsTab();
  const medicationDetails = await medicationsPage.medicationDetails();
  await medicationDetails.verifyAssociatedDx(DIAGNOSIS);
  await medicationDetails.verifyMedication(MEDICATION);
  await medicationDetails.verifyDose(DOSE);
  await medicationDetails.verifyUnits(UNITS);
  await medicationDetails.verifyManufacturer(MANUFACTURER);
  await medicationDetails.verifyRoute(ROUTE);
  await medicationDetails.verifyInstructions(INSTRUCTIONS);
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
