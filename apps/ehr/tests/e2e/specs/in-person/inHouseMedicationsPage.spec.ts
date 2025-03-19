import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { Field } from '../../page/EditMedicationCard';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectInPersonProgressNotePage } from '../../page/in-person/InPersonProgressNotePage';
import { expectEditOrderPage, OrderMedicationPage } from '../../page/OrderMedicationPage';
import { expectPatientInfoPage } from '../../page/PatientInfo';

const resourceHandler = new ResourceHandler('in-person');

const DIAGNOSIS = 'Situs inversus';
const MEDICATION = '0.9% Sodium Chloride IV (1000cc)';
const DOSE = '2';
const UNITS = 'mg';
const MANUFACTURER = 'Test';
const ROUTE = 'Route of administration values';
const INSTRUCTIONS = 'Instructions';

test.beforeEach(async () => {
  await resourceHandler.setResources();
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Open Order Medication screen, check all fields are required', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.verifyFillOrderToSaveButtonDisabled();
  await orderMedicationPage.editMedicationCard().selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.MEDICATION);
  await orderMedicationPage.editMedicationCard().selectAssociatedDx('Select associatedDx');
  await orderMedicationPage.editMedicationCard().selectMedication(MEDICATION);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.ASSOCIATED_DX);
  await orderMedicationPage.editMedicationCard().selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.DOSE);
  await orderMedicationPage.editMedicationCard().enterDose(DOSE);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.UNITS);
  await orderMedicationPage.editMedicationCard().selectUnits(UNITS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.MANUFACTURER);
  await orderMedicationPage.editMedicationCard().enterManufacturer(MANUFACTURER);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.ROUTE);
  await orderMedicationPage.editMedicationCard().selectRoute(ROUTE);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard().verifyValidationErrorShown(Field.INSTRUCTIONS);
});

test('Non-selected diagnosis on Assessment page is not present in Order Medication screen on associatedDx dropdown', async ({
  page,
}) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.editMedicationCard().verifyDiagnosisNotAllowed('Loiasis');
});

test('Non-numeric values can not be entered into "Dose" field', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.editMedicationCard().enterDose('abc1dfg');
  await orderMedicationPage.editMedicationCard().verifyDose('1');
});

test('Order medication, order is submitted successfully and entered data are displayed correctly', async ({ page }) => {
  const createOrderPage = await prepareAndOpenOrderMedicationPage(page);
  await createOrderPage.editMedicationCard().selectAssociatedDx(DIAGNOSIS);
  await createOrderPage.editMedicationCard().selectMedication(MEDICATION);
  await createOrderPage.editMedicationCard().enterDose(DOSE);
  await createOrderPage.editMedicationCard().selectUnits(UNITS);
  await createOrderPage.editMedicationCard().enterManufacturer(MANUFACTURER);
  await createOrderPage.editMedicationCard().selectRoute(ROUTE);
  await createOrderPage.editMedicationCard().enterInstructions(INSTRUCTIONS);
  await createOrderPage.clickOrderMedicationButton();

  const editOrderPage = await expectEditOrderPage(page);
  await editOrderPage.editMedicationCard().verifyAssociatedDx(DIAGNOSIS);
  await editOrderPage.editMedicationCard().verifyMedication(MEDICATION);
  await editOrderPage.editMedicationCard().verifyDose(DOSE);
  await editOrderPage.editMedicationCard().verifyUnits(UNITS);
  await editOrderPage.editMedicationCard().verifyManufacturer(MANUFACTURER);
  await editOrderPage.editMedicationCard().verifyRoute(ROUTE);
  await editOrderPage.editMedicationCard().verifyInstructions(INSTRUCTIONS);

  const medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.verifyMedicationPresent({
    medicationName: MEDICATION,
    dose: DOSE,
    route: ROUTE,
    instructions: INSTRUCTIONS,
    status: 'pending',
  });
  await medicationsPage.clickMedicationDetailsTab();
  await medicationsPage.medicationDetails().verifyAssociatedDx(DIAGNOSIS);
  await medicationsPage.medicationDetails().verifyMedication(MEDICATION);
  await medicationsPage.medicationDetails().verifyDose(DOSE);
  await medicationsPage.medicationDetails().verifyUnits(UNITS);
  await medicationsPage.medicationDetails().verifyManufacturer(MANUFACTURER);
  await medicationsPage.medicationDetails().verifyRoute(ROUTE);
  await medicationsPage.medicationDetails().verifyInstructions(INSTRUCTIONS);
});

test('Edit order page is opened after clicking on pencil icon for order in "pending" status', async ({ page }) => {
  const createOrderPage = await prepareAndOpenOrderMedicationPage(page);
  await createOrderPage.editMedicationCard().selectAssociatedDx(DIAGNOSIS);
  await createOrderPage.editMedicationCard().selectMedication(MEDICATION);
  await createOrderPage.editMedicationCard().enterDose(DOSE);
  await createOrderPage.editMedicationCard().selectUnits(UNITS);
  await createOrderPage.editMedicationCard().enterManufacturer(MANUFACTURER);
  await createOrderPage.editMedicationCard().selectRoute(ROUTE);
  await createOrderPage.editMedicationCard().enterInstructions(INSTRUCTIONS);
  await createOrderPage.clickOrderMedicationButton();

  //click on pencil icon opens Edit order page
  const editOrderPage = await expectEditOrderPage(page);
  let medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.clickPencilIcon();
  await expectEditOrderPage(page);

  //Update fields to empty values and click on [Save] - Validation errors appears
  await editOrderPage.editMedicationCard().selectMedication('Select Medication');
  await editOrderPage.editMedicationCard().selectAssociatedDx('Select associatedDx');
  await editOrderPage.editMedicationCard().clearDose();
  await editOrderPage.editMedicationCard().selectUnits('Select units');
  await editOrderPage.editMedicationCard().clearManufacturer();
  await editOrderPage.editMedicationCard().selectRoute('Select route');
  await editOrderPage.editMedicationCard().clearInstructions();
  await editOrderPage.clickOrderMedicationButton();

  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.MEDICATION);
  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.ASSOCIATED_DX, false);
  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.DOSE, false);
  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.UNITS, false);
  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.MANUFACTURER, false);
  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.ROUTE, false);
  await editOrderPage.editMedicationCard().verifyValidationErrorShown(Field.INSTRUCTIONS, false);

  //Updated values are saved successfully and Order is updated on the "MAR" tab
  await editOrderPage.editMedicationCard().selectAssociatedDx('Situational type phobia');
  await editOrderPage.editMedicationCard().selectMedication('0.9% Sodium Chloride IV (250cc)');
  await editOrderPage.editMedicationCard().enterDose('1');
  await editOrderPage.editMedicationCard().selectUnits('g');
  await editOrderPage.editMedicationCard().enterManufacturer('Edited test');
  await editOrderPage.editMedicationCard().selectRoute('Topical route');
  await editOrderPage.editMedicationCard().enterInstructions('Edited instructions');
  await editOrderPage.clickOrderMedicationButton();

  await editOrderPage.editMedicationCard().verifyMedication('0.9% Sodium Chloride IV (250cc)');
  await editOrderPage.editMedicationCard().verifyDose('1');
  await editOrderPage.editMedicationCard().verifyUnits('g');
  await editOrderPage.editMedicationCard().verifyManufacturer('Edited test');
  await editOrderPage.editMedicationCard().verifyRoute('Topical route');
  await editOrderPage.editMedicationCard().verifyInstructions('Edited instructions');

  medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.verifyMedicationPresent({
    medicationName: '0.9% Sodium Chloride IV (250cc)',
    dose: '1',
    route: 'Topical route',
    instructions: 'Edited instructions',
    status: 'pending',
  });
});

async function prepareAndOpenOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  await page.waitForTimeout(10000);
  const patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  const progressNotePage = await expectInPersonProgressNotePage(page);
  await patientInfoPage.sideMenu().clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis(DIAGNOSIS);
  await assessmentPage.selectDiagnosis('Situational type phobia');
  const inHouseMedicationsPage = await progressNotePage.sideMenu().clickInHouseMedications();
  return await inHouseMedicationsPage.clickOrderButton();
}
