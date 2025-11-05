import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { getFirstName, getLastName } from 'utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { DIAGNOSIS_EMPTY_VALUE, Field, ORDERED_BY_EMPTY_VALUE } from '../../page/EditMedicationCard';
import { InHouseMedicationsPage } from '../../page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectEditOrderPage, openOrderMedicationPage, OrderMedicationPage } from '../../page/OrderMedicationPage';

const PROCESS_ID = `inHouseMedicationsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

// cSpell:disable-next inversus
const DIAGNOSIS = 'Situs inversus';
const MEDICATION = 'Acetaminophen (80mg Suppository)';
const MEDICATION_FOR_ADMINISTERED = 'Albuterol';
const MEDICATION_FOR_PARTLY_ADMINISTERED = 'Amoxicillin';
const MEDICATION_FOR_NOT_ADMINISTERED = 'Ventolin HFA';

const DOSE = '2';
const UNITS = 'mg';
const MANUFACTURER = 'Test';
const ROUTE = 'Sublingual route';
const INSTRUCTIONS = 'Instructions';

const NEW_MEDICATION = 'Acetaminophen (325mg Suppository)';
const NEW_DOSE = '1';
const NEW_UNITS = 'g';
const NEW_MANUFACTURER = 'Edited test';
const NEW_ROUTE = 'Topical route';
const NEW_INSTRUCTIONS = 'Edited instructions';
const STATUS = 'pending';
const CANCELLED = 'Cancelled';
const ADMINISTERED = 'Administered';
const PATIENT_REFUSED = 'Patient refused';
const PARTLY_ADMINISTERED = 'Partly Administered';
const NOT_ADMINISTERED = 'Not Administered';

let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  if (process.env.INTEGRATION_TEST === 'true') {
    await resourceHandler.setResourcesFast();
  } else {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  }

  await prepareAppointment(page);
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
  await page.close();
  await context.close();
});

test('In-house medications page', async () => {
  let editOrderPage: OrderMedicationPage;
  let medicationsPage: InHouseMedicationsPage;
  let orderBy: string | undefined = undefined;
  const orderMedicationPage: OrderMedicationPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);

  await test.step('"Order" button is disabled when all fields are empty', async () => {
    await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS_EMPTY_VALUE);
    await orderMedicationPage.editMedicationCard.selectOrderedBy(ORDERED_BY_EMPTY_VALUE);
    await orderMedicationPage.verifyFillOrderToSaveButtonDisabled();
  });

  await test.step('Non-selected diagnosis on Assessment page is not present in Order Medication screen on associatedDx dropdown', async () => {
    // cSpell:disable-next Loiasis
    await orderMedicationPage.editMedicationCard.verifyDiagnosisNotAllowed('Loiasis');
  });

  // select diagnosis back
  await orderMedicationPage.editMedicationCard.chooseOption(DIAGNOSIS);
  // we have selected dx by default now so we can proceed to verification
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.MEDICATION);
  await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS_EMPTY_VALUE);
  await orderMedicationPage.editMedicationCard.selectMedication(MEDICATION);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.DOSE);
  await orderMedicationPage.editMedicationCard.enterDose(DOSE);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.UNITS);
  await orderMedicationPage.editMedicationCard.selectUnits(UNITS);
  await orderMedicationPage.clickOrderMedicationButton();
  await orderMedicationPage.editMedicationCard.verifyValidationErrorShown(Field.ROUTE);
  await orderMedicationPage.editMedicationCard.selectRoute(ROUTE);
  await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();
  orderBy = await orderMedicationPage.editMedicationCard.selectFirstNonEmptyOrderedBy();
  await orderMedicationPage.clickOrderMedicationButton();

  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.ASSOCIATED_DX);
  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.MANUFACTURER);
  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.INSTRUCTIONS);

  await orderMedicationPage.editMedicationCard.expectSaved();

  await test.step('Non-numeric values can not be entered into "Dose" field', async () => {
    await orderMedicationPage.editMedicationCard.enterDose('abc1dfg');
    // this is fine since will be transfered as 1 and then after saving will be 1
    await orderMedicationPage.editMedicationCard.verifyDose('01');
  });

  await test.step('Order medication, order is submitted successfully and entered data are displayed correctly in edit order page', async () => {
    await orderMedicationPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
    await orderMedicationPage.editMedicationCard.selectMedication(MEDICATION);
    await orderMedicationPage.editMedicationCard.enterDose(DOSE);
    await orderMedicationPage.editMedicationCard.selectUnits(UNITS);
    await orderMedicationPage.editMedicationCard.enterManufacturer(MANUFACTURER);
    await orderMedicationPage.editMedicationCard.selectRoute(ROUTE);
    await orderMedicationPage.editMedicationCard.enterInstructions(INSTRUCTIONS);
    await orderMedicationPage.editMedicationCard.waitForLoadOrderedBy();
    await orderMedicationPage.clickOrderMedicationButton();
    await orderMedicationPage.editMedicationCard.expectSaved();

    editOrderPage = await expectEditOrderPage(page);
    await editOrderPage.editMedicationCard.verifyAssociatedDx(DIAGNOSIS);
    await editOrderPage.editMedicationCard.verifyMedication(MEDICATION);
    await editOrderPage.editMedicationCard.verifyDose('0' + DOSE);
    await editOrderPage.editMedicationCard.verifyUnits(UNITS);
    await editOrderPage.editMedicationCard.verifyManufacturer(MANUFACTURER);
    // need to uncomment when https://github.com/masslight/ottehr/issues/3712 is fixed
    //await editOrderPage.editMedicationCard.verifyRoute(ROUTE);
    await editOrderPage.editMedicationCard.verifyInstructions(INSTRUCTIONS);
  });

  await test.step('Verify order data is displayed correctly in medication details tab', async () => {
    medicationsPage = await editOrderPage.clickBackButton();
    await medicationsPage.verifyMedicationPresent({
      medicationName: MEDICATION,
      dose: DOSE,
      units: UNITS,
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

  await test.step('Click on pencil icon opens Edit order page', async () => {
    await medicationsPage.clickMarTab();
    await medicationsPage.clickPencilIcon();
    editOrderPage = await expectEditOrderPage(page);
  });

  await test.step('Update order details and save, check on medications tabl', async () => {
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
    await orderMedicationPage.editMedicationCard.expectSaved();

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
      units: NEW_UNITS,
      route: NEW_ROUTE,
      instructions: NEW_INSTRUCTIONS,
      status: STATUS,
    });

    const progressNotePage = await medicationsPage.sideMenu().clickProgressNote();
    await progressNotePage.verifyInHouseMedication({
      medication: NEW_MEDICATION,
      dose: NEW_DOSE,
      units: NEW_UNITS,
      route: NEW_ROUTE,
      instructions: NEW_INSTRUCTIONS,
      status: 'Pending',
    });
  });

  await test.step('Delete the order', async () => {
    const inHouseMedicationsPage = await medicationsPage.sideMenu().clickInHouseMedications();
    const deleteDialog = await inHouseMedicationsPage.clickDeleteButton(NEW_MEDICATION);
    await deleteDialog.verifyTitle('Delete Medication');
    await deleteDialog.verifyMessage('Are you sure you want to delete the medication ' + '"' + NEW_MEDICATION + '"?');
    await deleteDialog.clickProceedButton();
    await inHouseMedicationsPage.verifyMedicationPresent({
      medicationName: NEW_MEDICATION,
      dose: NEW_DOSE,
      units: NEW_UNITS,
      route: NEW_ROUTE,
      orderedBy: orderBy,
      instructions: NEW_INSTRUCTIONS,
      status: CANCELLED,
    });
  });
});

test('Making in-house medication order Administered happy path', async () => {
  const medicationsPage = await createOrderForAdministration(MEDICATION_FOR_ADMINISTERED, page);

  const administrationConfirmationDialog = await medicationsPage.medicationDetails().clickAdministeredButton();
  await administrationConfirmationDialog.verifyTitle('Medication Administered');
  await administrationConfirmationDialog.verifyPatientName(resourceHandler.patient);
  await administrationConfirmationDialog.verifyMedication({
    medication: MEDICATION_FOR_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
  });
  await administrationConfirmationDialog.verifyMessage(
    'Please confirm that you want to mark this medication order as Administered.'
  );
  await administrationConfirmationDialog.clickMarkAsAdministeredButton();
  const inHouseMedicationsPage = await medicationsPage.sideMenu().clickInHouseMedications();
  await inHouseMedicationsPage.verifyMedicationPresent({
    medicationName: MEDICATION_FOR_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    orderedBy: await getCurrentPractitionerFirstLastName(),
    givenBy: await getCurrentPractitionerFirstLastName(),
    instructions: INSTRUCTIONS,
    status: ADMINISTERED,
  });
  const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
  await inHouseMedicationsPage.verifyMedicationInMedicationHistoryTable({
    medication: MEDICATION_FOR_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    type: 'In-house medication',
    whoAdded: getLastName(testUserPractitioner) + ', ' + getFirstName(testUserPractitioner),
  });
  const progressNotePage = await medicationsPage.sideMenu().clickProgressNote();
  await progressNotePage.verifyInHouseMedication({
    medication: MEDICATION_FOR_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    givenBy: await getCurrentPractitionerFirstLastName(),
    instructions: INSTRUCTIONS,
    status: ADMINISTERED,
  });
});

test('Making in-house medication order Partly Administered happy path', async () => {
  const medicationsPage = await createOrderForAdministration(MEDICATION_FOR_PARTLY_ADMINISTERED, page);

  const administrationConfirmationDialog = await medicationsPage.medicationDetails().clickPartlyAdministeredButton();
  await administrationConfirmationDialog.verifyTitle('Medication Partly Administered');
  await administrationConfirmationDialog.verifyPatientName(resourceHandler.patient);
  await administrationConfirmationDialog.verifyMedication({
    medication: MEDICATION_FOR_PARTLY_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
  });
  await administrationConfirmationDialog.verifyMessage(
    'Please confirm that you want to mark this medication order as Partly Administered and select the reason.'
  );
  await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
  await administrationConfirmationDialog.clickMarkAsAdministeredButton();
  const inHouseMedicationsPage = await medicationsPage.sideMenu().clickInHouseMedications();
  await inHouseMedicationsPage.verifyMedicationPresent({
    medicationName: MEDICATION_FOR_PARTLY_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    orderedBy: await getCurrentPractitionerFirstLastName(),
    givenBy: await getCurrentPractitionerFirstLastName(),
    instructions: INSTRUCTIONS,
    status: PARTLY_ADMINISTERED,
    reason: PATIENT_REFUSED,
  });
  const progressNotePage = await medicationsPage.sideMenu().clickProgressNote();
  await progressNotePage.verifyInHouseMedication({
    medication: MEDICATION_FOR_PARTLY_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    givenBy: await getCurrentPractitionerFirstLastName(),
    instructions: INSTRUCTIONS,
    status: PARTLY_ADMINISTERED,
  });
});

test('Making in-house medication order Not Administered happy path', async () => {
  const medicationsPage = await createOrderForAdministration(MEDICATION_FOR_NOT_ADMINISTERED, page);

  const administrationConfirmationDialog = await medicationsPage.medicationDetails().clickNotAdministeredButton();
  await administrationConfirmationDialog.verifyTitle('Medication Not Administered');
  await administrationConfirmationDialog.verifyPatientName(resourceHandler.patient);
  await administrationConfirmationDialog.verifyMedication({
    medication: MEDICATION_FOR_NOT_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
  });
  await administrationConfirmationDialog.verifyMessage(
    'Please confirm that you want to mark this medication order as Not Administered and select the reason.'
  );
  await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
  await administrationConfirmationDialog.clickMarkAsAdministeredButton();
  const inHouseMedicationsPage = await medicationsPage.sideMenu().clickInHouseMedications();
  await inHouseMedicationsPage.verifyMedicationPresent({
    medicationName: MEDICATION_FOR_NOT_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    orderedBy: await getCurrentPractitionerFirstLastName(),
    givenBy: await getCurrentPractitionerFirstLastName(),
    instructions: INSTRUCTIONS,
    status: NOT_ADMINISTERED,
    reason: PATIENT_REFUSED,
  });
  const progressNotePage = await medicationsPage.sideMenu().clickProgressNote();
  await progressNotePage.verifyInHouseMedication({
    medication: MEDICATION_FOR_NOT_ADMINISTERED,
    dose: DOSE,
    units: UNITS,
    route: ROUTE,
    givenBy: await getCurrentPractitionerFirstLastName(),
    instructions: INSTRUCTIONS,
    status: NOT_ADMINISTERED,
  });
});

async function prepareAppointment(page: Page): Promise<void> {
  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await inPersonHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  await sideMenu.clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
}

async function createOrderForAdministration(medication: string, page: Page): Promise<InHouseMedicationsPage> {
  const createOrderPage = await openOrderMedicationPage(resourceHandler.appointment.id!, page);
  await createOrderPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS);
  await createOrderPage.editMedicationCard.selectMedication(medication);
  await createOrderPage.editMedicationCard.enterDose(DOSE);
  await createOrderPage.editMedicationCard.selectUnits(UNITS);
  await createOrderPage.editMedicationCard.enterManufacturer(MANUFACTURER);
  await createOrderPage.editMedicationCard.selectRoute(ROUTE);
  await createOrderPage.editMedicationCard.enterInstructions(INSTRUCTIONS);
  await createOrderPage.editMedicationCard.waitForLoadOrderedBy();
  await createOrderPage.clickOrderMedicationButton();
  const editOrderPage = await expectEditOrderPage(page);
  const medicationsPage = await editOrderPage.clickBackButton();
  await medicationsPage.clickMedicationDetailsTab();
  await medicationsPage.medicationDetails().enterLotNumber('1234567');
  await medicationsPage.medicationDetails().enterExpiratrionDate('2100-10-10');
  return medicationsPage;
}

async function getCurrentPractitionerFirstLastName(): Promise<string> {
  const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
  return getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner);
}
