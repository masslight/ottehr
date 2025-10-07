import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { expectAdministrationConfirmationDialogue } from 'tests/e2e/page/in-person/Immunization/AdministrationConfirmationDialog';
import { openCreateVaccineOrderPage } from 'tests/e2e/page/in-person/Immunization/EditVaccineOrderPage';
import { openImmunizationPage } from 'tests/e2e/page/in-person/Immunization/ImmunizationPage';
import { expectVaccineDetailsPage } from 'tests/e2e/page/in-person/Immunization/VaccineDetailsPage';
import {
  InPersonProgressNotePage,
  openInPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const DTAP = 'No drugId vaccine'; //'Dtap (Diptheria, Tetanus, Pertussis)';
const DOSE_0_5 = '0.5';
const MG = 'mg';
const BODY_CAVITY_ROUTE = 'Body cavity route (qualifier value)';
const EAR_LEFT = 'Ear, Left';
const TEST_VACCINE_INSTRUCTIONS = 'test vaccine instructions';
const PENDING = 'PENDING';
const ADMINISTERED = 'ADMINISTERED';
const PARTLY_ADMINISTERED = 'PARTLY-ADMINISTERED';
const NOT_ADMINISTRED = 'NOT-ADMINISTERED';
const CANCELLED = 'CANCELLED';

const TDAP = 'Tdap (Tetanus, Diphtheria, Pertussis)';
const DOSE_1_0 = '1';
const ML = 'mL';
const CAUDAL_ROUTE = 'Caudal route (qualifier value)';
const EYE_LEFT = 'Eye, Left';
const TEST_VACCINE_INSTRUCTIONS_EDITED = 'test vaccine instructions edited';

const LOT_NUMBER = '1234567';
const EXP_DATE = '01/01/2030';
const MVX_CODE = '1111fff';
const CVX_CODE = 'aaa222';
const CPT_CODE = '11900';
const NDC_CODE = '7777frttty';
const ADMINISTERED_DATE = '02/10/2025';
const ADMINISTERED_TIME = '10:50 AM';
const VIS_GIVEN_DATE = '03/10/2025';
const RELATIONSHIP = 'Parent';
const FULL_NAME = 'John Doe';
const MOBILE = '(202) 713-9680';
const PATIENT_REFUSED = 'Patient refused';

const resourceHandler = new ResourceHandler(`immunization-mutating-${DateTime.now().toMillis()}`);

test.describe('Immunization Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    }
    await setupPractitioners(page);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Immunization happy path for creating and editing order', async ({ page }) => {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await createOrderPage.orderDetailsSection.selectVaccine(DTAP);
    await createOrderPage.orderDetailsSection.enterDose(DOSE_0_5);
    await createOrderPage.orderDetailsSection.selectUnits(MG);
    await createOrderPage.orderDetailsSection.selectRoute(BODY_CAVITY_ROUTE);
    await createOrderPage.orderDetailsSection.selectLocation(EAR_LEFT);
    await createOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS);
    await createOrderPage.clickConfirmationButton();

    let immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.verifyVaccinePresent({
      vaccineName: DTAP,
      doseRoute: DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS,
      status: PENDING,
    });

    let editOrderPage = await immunizationPage.clickEditOrderButton(DTAP);
    await editOrderPage.orderDetailsSection.verifyVaccine(DTAP);
    await editOrderPage.orderDetailsSection.verifyDose(DOSE_0_5);
    await editOrderPage.orderDetailsSection.verifyUnits(MG);
    await editOrderPage.orderDetailsSection.verifyRoute(BODY_CAVITY_ROUTE);
    await editOrderPage.orderDetailsSection.verifyLocation(EAR_LEFT);
    await editOrderPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS);
    // edit order, click save
    await editOrderPage.orderDetailsSection.selectVaccine(TDAP);
    await editOrderPage.orderDetailsSection.enterDose(DOSE_1_0);
    await editOrderPage.orderDetailsSection.selectUnits(ML);
    await editOrderPage.orderDetailsSection.selectRoute(CAUDAL_ROUTE);
    await editOrderPage.orderDetailsSection.selectLocation(EYE_LEFT);
    await editOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS_EDITED);
    await editOrderPage.clickConfirmationButton();

    // check immunization table
    immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.verifyVaccinePresent({
      vaccineName: TDAP,
      doseRoute: DOSE_1_0 + ' ' + ML + ' / ' + CAUDAL_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS_EDITED,
      status: PENDING,
    });

    editOrderPage = await immunizationPage.clickEditOrderButton(TDAP);
    await editOrderPage.orderDetailsSection.verifyVaccine(TDAP);
    await editOrderPage.orderDetailsSection.verifyDose(DOSE_1_0);
    await editOrderPage.orderDetailsSection.verifyUnits(ML);
    await editOrderPage.orderDetailsSection.verifyRoute(CAUDAL_ROUTE);
    await editOrderPage.orderDetailsSection.verifyLocation(EYE_LEFT);
    await editOrderPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS_EDITED);
    //todo: cancel order
    const deleteDialog = await immunizationPage.clickDeleteButton(TDAP);
    await deleteDialog.verifyTitle('Delete vaccine order');
    await deleteDialog.verifyMessage('Are you sure you want to delete the vaccine order?');
    await deleteDialog.clickCancelButton();
    await immunizationPage.verifyVaccinePresent({
      vaccineName: TDAP,
      doseRoute: DOSE_1_0 + ' ' + ML + ' / ' + CAUDAL_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS_EDITED,
      status: CANCELLED,
    });
  });

  test('Immunization happy path for making order administered', async ({ page }) => {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await createOrderPage.orderDetailsSection.selectVaccine(DTAP);
    await createOrderPage.orderDetailsSection.enterDose(DOSE_0_5);
    await createOrderPage.orderDetailsSection.selectUnits(MG);
    await createOrderPage.orderDetailsSection.selectRoute(BODY_CAVITY_ROUTE);
    await createOrderPage.orderDetailsSection.selectLocation(EAR_LEFT);
    await createOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS);
    await createOrderPage.clickConfirmationButton();

    const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.clickVaccineDetailsTab();
    const vaccineDetailsPage = await expectVaccineDetailsPage(page);
    await vaccineDetailsPage.orderDetailsSection.verifyVaccine(DTAP);
    await vaccineDetailsPage.orderDetailsSection.verifyDose(DOSE_0_5);
    await vaccineDetailsPage.orderDetailsSection.verifyUnits(MG);
    await vaccineDetailsPage.orderDetailsSection.verifyRoute(BODY_CAVITY_ROUTE);
    await vaccineDetailsPage.orderDetailsSection.verifyLocation(EAR_LEFT);
    await vaccineDetailsPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS);
    await vaccineDetailsPage.enterLotNumber(LOT_NUMBER);
    await vaccineDetailsPage.enterExpiredDate(EXP_DATE);
    await vaccineDetailsPage.enterMvxCode(MVX_CODE);
    await vaccineDetailsPage.enterCvxCode(CVX_CODE);
    await vaccineDetailsPage.selectCptCode(CPT_CODE);
    await vaccineDetailsPage.enterNdcCode(NDC_CODE);
    await vaccineDetailsPage.enterAdministeredDate(ADMINISTERED_DATE);
    await vaccineDetailsPage.enterAdministeredTime(ADMINISTERED_TIME);
    await vaccineDetailsPage.setVisCheckboxChecked(true);
    await vaccineDetailsPage.enterVisGivenDate(VIS_GIVEN_DATE);
    await vaccineDetailsPage.selectRelationship(RELATIONSHIP);
    await vaccineDetailsPage.enterFullName(FULL_NAME);
    await vaccineDetailsPage.enterMobile(MOBILE);
    await vaccineDetailsPage.clickAdministeredButton();
    const administrationConfirmationDialog = await expectAdministrationConfirmationDialogue(page);
    await administrationConfirmationDialog.verifyTitle('Order Administered');
    await administrationConfirmationDialog.verifyPatientName(
      'Patient: ' + resourceHandler.patient?.name?.[0]?.family + ', ' + resourceHandler.patient?.name?.[0]?.given?.[0]
    );
    await administrationConfirmationDialog.verifyVaccine(
      'Vaccine: ' + DTAP + ' / ' + DOSE_0_5 + MG + ' / ' + BODY_CAVITY_ROUTE
    );
    await administrationConfirmationDialog.verifyMessage(
      'Please confirm that you want to mark this immunization order as Administered.'
    );
    await administrationConfirmationDialog.clickMarkAsAdministeredButton();
    await immunizationPage.clickMarTab();
    await immunizationPage.verifyVaccinePresent({
      vaccineName: DTAP,
      doseRoute: DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS,
      status: ADMINISTERED,
      //todo: check Given column data
    });

    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyVaccine(
      DTAP + ' - ' + DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE + ' - ' + EAR_LEFT
    );
  });

  test('Immunization happy path for making order partly administered', async ({ page }) => {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await createOrderPage.orderDetailsSection.selectVaccine(DTAP);
    await createOrderPage.orderDetailsSection.enterDose(DOSE_0_5);
    await createOrderPage.orderDetailsSection.selectUnits(MG);
    await createOrderPage.orderDetailsSection.selectRoute(BODY_CAVITY_ROUTE);
    await createOrderPage.orderDetailsSection.selectLocation(EAR_LEFT);
    await createOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS);
    await createOrderPage.clickConfirmationButton();

    const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.clickVaccineDetailsTab();
    const vaccineDetailsPage = await expectVaccineDetailsPage(page);
    await vaccineDetailsPage.orderDetailsSection.verifyVaccine(DTAP);
    await vaccineDetailsPage.orderDetailsSection.verifyDose(DOSE_0_5);
    await vaccineDetailsPage.orderDetailsSection.verifyUnits(MG);
    await vaccineDetailsPage.orderDetailsSection.verifyRoute(BODY_CAVITY_ROUTE);
    await vaccineDetailsPage.orderDetailsSection.verifyLocation(EAR_LEFT);
    await vaccineDetailsPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS);
    await vaccineDetailsPage.enterLotNumber(LOT_NUMBER);
    await vaccineDetailsPage.enterExpiredDate(EXP_DATE);
    await vaccineDetailsPage.enterMvxCode(MVX_CODE);
    await vaccineDetailsPage.enterCvxCode(CVX_CODE);
    await vaccineDetailsPage.selectCptCode(CPT_CODE);
    await vaccineDetailsPage.enterNdcCode(NDC_CODE);
    await vaccineDetailsPage.enterAdministeredDate(ADMINISTERED_DATE);
    await vaccineDetailsPage.enterAdministeredTime(ADMINISTERED_TIME);
    await vaccineDetailsPage.setVisCheckboxChecked(true);
    await vaccineDetailsPage.enterVisGivenDate(VIS_GIVEN_DATE);
    await vaccineDetailsPage.selectRelationship(RELATIONSHIP);
    await vaccineDetailsPage.enterFullName(FULL_NAME);
    await vaccineDetailsPage.enterMobile(MOBILE);
    await vaccineDetailsPage.clickPartlyAdministeredButton();
    const administrationConfirmationDialog = await expectAdministrationConfirmationDialogue(page);
    await administrationConfirmationDialog.verifyTitle('Order Partly Administered');
    await administrationConfirmationDialog.verifyPatientName(
      'Patient: ' + resourceHandler.patient?.name?.[0]?.family + ', ' + resourceHandler.patient?.name?.[0]?.given?.[0]
    );
    await administrationConfirmationDialog.verifyVaccine(
      'Vaccine: ' + DTAP + ' / ' + DOSE_0_5 + MG + ' / ' + BODY_CAVITY_ROUTE
    );
    await administrationConfirmationDialog.verifyMessage(
      'Please confirm that you want to mark this immunization order as Partly Administered and select the reason.'
    );
    await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
    await administrationConfirmationDialog.clickMarkAsAdministeredButton();
    await immunizationPage.clickMarTab();
    await immunizationPage.verifyVaccinePresent({
      vaccineName: DTAP,
      doseRoute: DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS,
      status: PARTLY_ADMINISTERED,
      reason: PATIENT_REFUSED,
      //todo: check Given column data
    });

    const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
    await progressNotePage.verifyVaccine(
      DTAP + ' - ' + DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE + ' - ' + EAR_LEFT
    );
  });

  test('Immunization happy path for making order not administered', async ({ page }) => {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await createOrderPage.orderDetailsSection.selectVaccine(DTAP);
    await createOrderPage.orderDetailsSection.enterDose(DOSE_0_5);
    await createOrderPage.orderDetailsSection.selectUnits(MG);
    await createOrderPage.orderDetailsSection.selectRoute(BODY_CAVITY_ROUTE);
    await createOrderPage.orderDetailsSection.selectLocation(EAR_LEFT);
    await createOrderPage.orderDetailsSection.enterInstructions(TEST_VACCINE_INSTRUCTIONS);
    await createOrderPage.clickConfirmationButton();

    const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    await immunizationPage.clickVaccineDetailsTab();
    const vaccineDetailsPage = await expectVaccineDetailsPage(page);
    await vaccineDetailsPage.orderDetailsSection.verifyVaccine(DTAP);
    await vaccineDetailsPage.orderDetailsSection.verifyDose(DOSE_0_5);
    await vaccineDetailsPage.orderDetailsSection.verifyUnits(MG);
    await vaccineDetailsPage.orderDetailsSection.verifyRoute(BODY_CAVITY_ROUTE);
    await vaccineDetailsPage.orderDetailsSection.verifyLocation(EAR_LEFT);
    await vaccineDetailsPage.orderDetailsSection.verifyInstructions(TEST_VACCINE_INSTRUCTIONS);
    await vaccineDetailsPage.enterLotNumber(LOT_NUMBER);
    await vaccineDetailsPage.enterExpiredDate(EXP_DATE);
    await vaccineDetailsPage.enterMvxCode(MVX_CODE);
    await vaccineDetailsPage.enterCvxCode(CVX_CODE);
    await vaccineDetailsPage.selectCptCode(CPT_CODE);
    await vaccineDetailsPage.enterNdcCode(NDC_CODE);
    await vaccineDetailsPage.enterAdministeredDate(ADMINISTERED_DATE);
    await vaccineDetailsPage.enterAdministeredTime(ADMINISTERED_TIME);
    await vaccineDetailsPage.setVisCheckboxChecked(true);
    await vaccineDetailsPage.enterVisGivenDate(VIS_GIVEN_DATE);
    await vaccineDetailsPage.selectRelationship(RELATIONSHIP);
    await vaccineDetailsPage.enterFullName(FULL_NAME);
    await vaccineDetailsPage.enterMobile(MOBILE);
    await vaccineDetailsPage.clickPartlyAdministeredButton();
    const administrationConfirmationDialog = await expectAdministrationConfirmationDialogue(page);
    await administrationConfirmationDialog.verifyTitle('Order Not Administered');
    await administrationConfirmationDialog.verifyPatientName(
      'Patient: ' + resourceHandler.patient?.name?.[0]?.family + ', ' + resourceHandler.patient?.name?.[0]?.given?.[0]
    );
    await administrationConfirmationDialog.verifyVaccine(
      'Vaccine: ' + DTAP + ' / ' + DOSE_0_5 + MG + ' / ' + BODY_CAVITY_ROUTE
    );
    await administrationConfirmationDialog.verifyMessage(
      'Please confirm that you want to mark this immunization order as Not Administered and select the reason.'
    );
    await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
    await administrationConfirmationDialog.clickMarkAsAdministeredButton();
    await immunizationPage.clickMarTab();
    await immunizationPage.verifyVaccinePresent({
      vaccineName: DTAP,
      doseRoute: DOSE_0_5 + ' ' + MG + ' / ' + BODY_CAVITY_ROUTE,
      instructions: TEST_VACCINE_INSTRUCTIONS,
      status: NOT_ADMINISTRED,
      reason: PATIENT_REFUSED,
      //todo: check Given column data
    });
  });

  async function setupPractitioners(page: Page): Promise<void> {
    const progressNotePage = new InPersonProgressNotePage(page);
    const inPersonHeader = new InPersonHeader(page);
    await page.goto(`in-person/${resourceHandler.appointment.id}/progress-note`);
    await inPersonHeader.verifyStatus('pending');
    await inPersonHeader.selectIntakePractitioner();
    await inPersonHeader.selectProviderPractitioner();
    await inPersonHeader.clickSwitchModeButton('provider');
    await progressNotePage.expectLoaded();
  }
});
