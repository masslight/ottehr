import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { DIAGNOSIS_EMPTY_VALUE, Field, ORDERED_BY_EMPTY_VALUE } from '../../page/EditMedicationCard';
import { InHouseMedicationsPage } from '../../page/in-person/InHouseMedicationsPage';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectEditOrderPage, OrderMedicationPage } from '../../page/OrderMedicationPage';

const PROCESS_ID = `inHouseMedicationsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

// cSpell:disable-next inversus
const DIAGNOSIS = 'Situs inversus';
const MEDICATION = 'Acetaminophen (80mg Suppository)';
const DOSE = '2';
const UNITS = 'mg';
const MANUFACTURER = 'Test';
const ROUTE = 'Sublingual route';
const INSTRUCTIONS = 'Instructions';

const NEW_DIAGNOSIS = 'Situational type phobia';
const NEW_MEDICATION = 'Acetaminophen (325mg Suppository)';
const NEW_DOSE = '1';
const NEW_UNITS = 'g';
const NEW_MANUFACTURER = 'Edited test';
const NEW_ROUTE = 'Topical route';
const NEW_INSTRUCTIONS = 'Edited instructions';
const STATUS = 'pending';

let page: Page;
let context: BrowserContext;

let orderMedicationPage: OrderMedicationPage;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources();
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

  await page.goto(`in-person/${resourceHandler.appointment.id}`);
  const inPersonHeader = new InPersonHeader(page);
  await inPersonHeader.selectIntakePractitioner();
  await inPersonHeader.selectProviderPractitioner();
  await inPersonHeader.clickSwitchModeButton('provider');
  const sideMenu = new SideMenu(page);
  await sideMenu.clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS });
  await assessmentPage.selectDiagnosis({ diagnosisNamePart: NEW_DIAGNOSIS });
  const inHouseMedicationsPage = await sideMenu.clickInHouseMedications();
  orderMedicationPage = await inHouseMedicationsPage.clickOrderButton();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
  await page.close();
  await context.close();
});

test('In-house medications page', async () => {
  let editOrderPage: OrderMedicationPage;
  let medicationsPage: InHouseMedicationsPage;

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
  await orderMedicationPage.editMedicationCard.selectFirstNonEmptyOrderedBy();
  await orderMedicationPage.clickOrderMedicationButton();

  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.ASSOCIATED_DX);
  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.MANUFACTURER);
  await orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(Field.INSTRUCTIONS);

  await orderMedicationPage.editMedicationCard.expectSaved();

  await test.step('Non-numeric values can not be entered into "Dose" field', async () => {
    await orderMedicationPage.editMedicationCard.enterDose('abc1dfg');
    // this is fine since will be transferred as 1 and then after saving will be 1
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

  await test.step('Update order details and save, check on medications table', async () => {
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
      route: NEW_ROUTE,
      instructions: NEW_INSTRUCTIONS,
      status: STATUS,
    });
  });
});
