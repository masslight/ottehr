import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { Field } from '../../page/EditMedicationCard';
import { InHouseMedicationsPage } from '../../page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectInPersonProgressNotePage } from '../../page/in-person/InPersonProgressNotePage';
import { expectEditOrderPage, OrderMedicationPage } from '../../page/OrderMedicationPage';
import { expectPatientInfoPage } from '../../page/PatientInfo';

const PROCESS_ID = `inHouseMedicationsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

// cSpell:disable-next inversus
const DIAGNOSIS = 'Situs inversus';
const MEDICATION = '0.9% Sodium Chloride IV (1000cc)';
const DOSE = '2';
const UNITS = 'mg';
const MANUFACTURER = 'Test';
const ROUTE = 'Route of administration values';
const INSTRUCTIONS = 'Instructions';

const NEW_DIAGNOSIS = 'Situational type phobia';
const NEW_MEDICATION = '0.9% Sodium Chloride IV (250cc)';
const NEW_DOSE = '1';
const NEW_UNITS = 'g';
const NEW_MANUFACTURER = 'Edited test';
const NEW_ROUTE = 'Topical route';
const NEW_INSTRUCTIONS = 'Edited instructions';
const STATUS = 'pending';

test.beforeEach(async () => {
  if (process.env.INTEGRATION_TEST === 'true') {
    await resourceHandler.setResourcesFast();
  } else {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  }
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Open Order Medication screen, check all fields are required', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  // we have selected dx by default now so we can proceed to verification
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.MEDICATION);
  await orderMedicationPage.editMedicationCard.selectAssociatedDx('Select associatedDx');
  await orderMedicationPage.editMedicationCard.selectMedication(MEDICATION);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.ASSOCIATED_DX);
  await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.DOSE);
  await orderMedicationPage.editMedicationCard.enterDose(DOSE);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.UNITS);
  await orderMedicationPage.editMedicationCard.selectUnits(UNITS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.ROUTE);
  await orderMedicationPage.editMedicationCard.selectRoute(ROUTE);
  await orderMedicationPage.clickOrderMedicationButton();

  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.MANUFACTURER);
  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.INSTRUCTIONS);
});

test('"Order" button is disabled when all fields are empty', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.editMedicationCard.selectAssociatedDx('Select associatedDx');
  await orderMedicationPage.verifyFillOrderToSaveButtonDisabled();
});

test('Non-selected diagnosis on Assessment page is not present in Order Medication screen on associatedDx dropdown', async ({
  page,
}) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  // cSpell:disable-next Loiasis
  await orderMedicationPage.editMedicationCard.verifyDiagnosisNotAllowed('Loiasis');
});

test('Non-numeric values can not be entered into "Dose" field', async ({ page }) => {
  const orderMedicationPage = await prepareAndOpenOrderMedicationPage(page);
  await orderMedicationPage.editMedicationCard.enterDose('abc1dfg');
  await orderMedicationPage.editMedicationCard.verifyDose('1');
});

test('Order medication, order is submitted successfully and entered data are displayed correctly', async ({ page }) => {
  const createOrderPage = await prepareAndOpenOrderMedicationPage(page);
  await createOrderPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await createOrderPage.editMedicationCard.selectMedication(MEDICATION);
  await createOrderPage.editMedicationCard.enterDose(DOSE);
  await createOrderPage.editMedicationCard.selectUnits(UNITS);
  await createOrderPage.editMedicationCard.enterManufacturer(MANUFACTURER);
  await createOrderPage.editMedicationCard.selectRoute(ROUTE);
  await createOrderPage.editMedicationCard.enterInstructions(INSTRUCTIONS);
  await createOrderPage.clickOrderMedicationButton();

  const editOrderPage = await expectEditOrderPage(page);
  await editOrderPage.editMedicationCard.verifyAssociatedDx(DIAGNOSIS);
  await editOrderPage.editMedicationCard.verifyMedication(MEDICATION);
  await editOrderPage.editMedicationCard.verifyDose(DOSE);
  await editOrderPage.editMedicationCard.verifyUnits(UNITS);
  await editOrderPage.editMedicationCard.verifyManufacturer(MANUFACTURER);
  await editOrderPage.editMedicationCard.verifyRoute(ROUTE);
  await editOrderPage.editMedicationCard.verifyInstructions(INSTRUCTIONS);

  const medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.verifyMedicationPresent({
    medicationName: MEDICATION,
    dose: DOSE,
    route: ROUTE,
    instructions: INSTRUCTIONS,
    status: STATUS,
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
  let editOrderPage: OrderMedicationPage;
  let medicationsPage: InHouseMedicationsPage;

  await test.step('Create order', async () => {
    await createOrderPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
    await createOrderPage.editMedicationCard.selectMedication(MEDICATION);
    await createOrderPage.editMedicationCard.enterDose(DOSE);
    await createOrderPage.editMedicationCard.selectUnits(UNITS);
    await createOrderPage.editMedicationCard.enterManufacturer(MANUFACTURER);
    await createOrderPage.editMedicationCard.selectRoute(ROUTE);
    await createOrderPage.editMedicationCard.enterInstructions(INSTRUCTIONS);
    await createOrderPage.clickOrderMedicationButton();
    editOrderPage = await expectEditOrderPage(page);
  });

  await test.step('Click on pencil icon opens Edit order page', async () => {
    const medicationsPage = await editOrderPage.clickBackButton();
    await medicationsPage.clickPencilIcon();
    editOrderPage = await expectEditOrderPage(page);
  });

  await test.step('Update fields to empty values and click on [Save] - Validation errors appears', async () => {
    await editOrderPage.editMedicationCard.selectMedication('Select Medication');
    await editOrderPage.editMedicationCard.selectAssociatedDx('Select associatedDx');
    await editOrderPage.editMedicationCard.clearDose();
    await editOrderPage.editMedicationCard.selectUnits('Select units');
    await editOrderPage.editMedicationCard.clearManufacturer();
    await editOrderPage.editMedicationCard.selectRoute('Select route');
    await editOrderPage.editMedicationCard.clearInstructions();
    await editOrderPage.clickOrderMedicationButton();

    await editOrderPage.editMedicationCard.verifyValidationErrorShown(Field.MEDICATION);
    await editOrderPage.editMedicationCard.verifyValidationErrorShown(Field.ASSOCIATED_DX, false);
    await editOrderPage.editMedicationCard.verifyValidationErrorShown(Field.DOSE, false);
    await editOrderPage.editMedicationCard.verifyValidationErrorShown(Field.UNITS, false);
    await editOrderPage.editMedicationCard.verifyValidationErrorNotShown(Field.MANUFACTURER);
    await editOrderPage.editMedicationCard.verifyValidationErrorShown(Field.ROUTE, false);
    await editOrderPage.editMedicationCard.verifyValidationErrorNotShown(Field.INSTRUCTIONS);
  });

  await test.step('Edit order page is opened after clicking on pencil icon for order in "pending" status', async () => {
    medicationsPage = await editOrderPage.clickBackButton();
    await medicationsPage.clickPencilIcon();

    //click on pencil icon opens Edit order page
    editOrderPage = await expectEditOrderPage(page);
    //Updated values are saved successfully and Order is updated on the "MAR" tab
    await editOrderPage.editMedicationCard.selectMedication(NEW_MEDICATION);
    await editOrderPage.editMedicationCard.enterDose(NEW_DOSE);
    // TODO: investigate why this is not working in playwright
    // await editOrderPage.editMedicationCard.selectAssociatedDx(NEW_DIAGNOSIS);
    await editOrderPage.editMedicationCard.selectUnits(NEW_UNITS);
    await editOrderPage.editMedicationCard.enterManufacturer(NEW_MANUFACTURER);
    await editOrderPage.editMedicationCard.selectRoute(NEW_ROUTE);
    await editOrderPage.editMedicationCard.enterInstructions(NEW_INSTRUCTIONS);
    await editOrderPage.clickOrderMedicationButton();

    await editOrderPage.editMedicationCard.verifyMedication(NEW_MEDICATION);
    await editOrderPage.editMedicationCard.verifyDose(NEW_DOSE);
    await editOrderPage.editMedicationCard.verifyUnits(NEW_UNITS);
    await editOrderPage.editMedicationCard.verifyManufacturer(NEW_MANUFACTURER);
    await editOrderPage.editMedicationCard.verifyRoute(NEW_ROUTE);
    await editOrderPage.editMedicationCard.verifyInstructions(NEW_INSTRUCTIONS);

    medicationsPage = await editOrderPage.clickBackButton();
    await medicationsPage.verifyMedicationPresent({
      medicationName: NEW_MEDICATION,
      dose: NEW_DOSE,
      route: NEW_ROUTE,
      instructions: NEW_INSTRUCTIONS,
      status: STATUS,
    });
  });
});

async function prepareAndOpenOrderMedicationPage(page: Page): Promise<OrderMedicationPage> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const patientInfoPage = await expectPatientInfoPage(resourceHandler.appointment.id!, page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  const progressNotePage = await expectInPersonProgressNotePage(page);
  await patientInfoPage.sideMenu().clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: NEW_DIAGNOSIS });
  const inHouseMedicationsPage = await progressNotePage.sideMenu().clickInHouseMedications();
  return await inHouseMedicationsPage.clickOrderButton();
}
