import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForSaveChartDataResponse } from 'test-utils';
import {
  expectEditVaccineOrderPage,
  openCreateVaccineOrderPage,
} from 'tests/e2e/page/in-person/Immunization/EditVaccineOrderPage';
import { openImmunizationPage } from 'tests/e2e/page/in-person/Immunization/ImmunizationPage';
import { expectMarTab } from 'tests/e2e/page/in-person/Immunization/MarTab';
import { OrderDetailsSection } from 'tests/e2e/page/in-person/Immunization/OrderDetailsSection';
import { VaccineDetailsTab } from 'tests/e2e/page/in-person/Immunization/VaccineDetailsTab';
import { openInPersonProgressNotePage } from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { SideMenu } from 'tests/e2e/page/SideMenu';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { getFirstName, getLastName, medicationApplianceLocations, medicationApplianceRoutes } from 'utils';
import vaccines from '../../../../../../config/oystehr/vaccines.json' assert { type: 'json' };

interface VaccineInfo {
  vaccine: string;
  dose: string;
  units: string;
  route: string;
  location: string;
  instructions: string;
  manufacturer: string;
  associatedDx: string;
}

interface AdministrationDetails {
  lotNumber: string;
  expiredDate: string;
  mvxCode: string;
  cvxCode: string;
  ndcCode: string;
  cptCode: string;
  administeredDate: string;
  administeredTime: string;
  visGivenDate: string;
  relationship: string;
  fullName: string;
  mobile: string;
}

const vaccineKeys = Object.keys(vaccines.fhirResources);
// Clamp to the available vaccines: instances may configure only a single vaccine, in which
// case the administration tests reuse it (the test locators tolerate the resulting duplicate
// MAR/progress-note entries). When more vaccines exist, each test gets a distinct one.
const vaccineNameAt = (index: number): string =>
  vaccines.fhirResources[vaccineKeys[Math.min(index, vaccineKeys.length - 1)] as keyof typeof vaccines.fhirResources]
    ?.resource.identifier[1].value;

const vaccine = vaccineNameAt(0);

const DIAGNOSIS_CODE_ONE = 'J45.901';
const DIAGNOSIS_CODE_TWO = 'J45.991';

const VACCINE: VaccineInfo = {
  vaccine,
  dose: '0.5',
  units: 'mg',
  route: medicationApplianceRoutes.BODY_CAVITY.display!,
  location: medicationApplianceLocations[0].name!,
  instructions: 'test vaccine instructions',
  manufacturer: 'example',
  associatedDx: DIAGNOSIS_CODE_ONE,
};

const EDITED_VACCINE: VaccineInfo = {
  vaccine,
  dose: '1',
  units: 'mL',
  route: medicationApplianceRoutes.CAUDAL.display!,
  location: medicationApplianceLocations[1].name!,
  instructions: 'test vaccine instructions edited',
  manufacturer: 'example edited',
  associatedDx: DIAGNOSIS_CODE_TWO,
};

// The administration tests share a single appointment, so the orders they leave behind
// accumulate on the MAR and the progress note. Each test uses a distinct vaccine where the
// instance configures enough of them, which keeps list entries unique; on single-vaccine
// instances these collapse to the same vaccine and the tests rely on status-based MAR
// filtering and first-match progress-note assertions instead.
const ADMINISTERED_VACCINE: VaccineInfo = { ...VACCINE, vaccine: vaccineNameAt(0) };
const PARTLY_ADMINISTERED_VACCINE: VaccineInfo = { ...VACCINE, vaccine: vaccineNameAt(1) };
const NOT_ADMINISTERED_VACCINE: VaccineInfo = { ...VACCINE, vaccine: vaccineNameAt(2) };

const ADMINISTRATION_DETAILS: AdministrationDetails = {
  lotNumber: '1234567',
  expiredDate: '01/01/2030',
  mvxCode: '1111fff',
  cvxCode: 'aaa222',
  cptCode: '11900',
  ndcCode: '555555ftf',
  administeredDate: '02/10/2025',
  administeredTime: '10:50 AM',
  visGivenDate: '03/10/2025',
  relationship: 'Parent',
  fullName: 'John Doe',
  mobile: '(202) 713-9680',
};

const PENDING = 'PENDING';
const ADMINISTERED = 'ADMINISTERED';
const PARTLY_ADMINISTERED = 'PARTLY-ADMINISTERED';
const NOT_ADMINISTERED = 'NOT-ADMINISTERED';
const CANCELLED = 'CANCELLED';
const PATIENT_REFUSED = 'Patient refused';

const resourceHandler = new ResourceHandler(`immunization-mutating-${DateTime.now().toMillis()}`);

test.describe('Immunization Page mutating tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.skip(!vaccineKeys.length, 'Need vaccines to run immunization tests');

  // These tests share a single appointment to avoid paying for an expensive appointment
  // creation + preprocessing wait on every test. They run serially and each test creates
  // its own vaccine order, which is identified on the MAR by vaccine + status, so the
  // orders left behind by earlier tests don't interfere. The only locators that match by
  // vaccine name alone (edit/delete) are used exclusively by the first test, which runs
  // against an appointment that still has just its own order.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();

    // Appointment-level setup (practitioners + diagnoses) only needs to happen once.
    await setupPractitioners(page);
    await setupDiagnosis(page);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    await resourceHandler.cleanupResources();
  });

  test('Immunization create, edit and delete order happy path', async () => {
    await test.step('Create a vaccine order and verify', async () => {
      const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
      await enterVaccineInfo(VACCINE, createOrderPage.orderDetailsSection);
      await createOrderPage.orderDetailsSection.verifyOrderedBy(await getCurrentPractitionerName());
      await createOrderPage.clickConfirmationButton();
      await openImmunizationPage(resourceHandler.appointment.id!, page);
      const marTab = await expectMarTab(page);
      await marTab.verifyVaccinePresent({
        ...VACCINE,
        orderedPerson: await getCurrentPractitionerName(),
        status: PENDING,
      });
      const editOrderPage = await marTab.clickEditOrderButton(VACCINE.vaccine);
      await verifyVaccineInfo(VACCINE, editOrderPage.orderDetailsSection);
    });

    await test.step('Edit vaccine order and verify', async () => {
      let editOrderPage = await expectEditVaccineOrderPage(page);
      await enterVaccineInfo(EDITED_VACCINE, editOrderPage.orderDetailsSection);
      await editOrderPage.clickConfirmationButton();
      await openImmunizationPage(resourceHandler.appointment.id!, page);
      const marTab = await expectMarTab(page);
      await marTab.verifyVaccinePresent({
        ...EDITED_VACCINE,
        status: PENDING,
      });
      editOrderPage = await marTab.clickEditOrderButton(EDITED_VACCINE.vaccine);
      await verifyVaccineInfo(EDITED_VACCINE, editOrderPage.orderDetailsSection);
    });

    await test.step('Delete the order and verify', async () => {
      await openImmunizationPage(resourceHandler.appointment.id!, page);
      const marTab = await expectMarTab(page);
      const deleteDialog = await marTab.clickDeleteButton(EDITED_VACCINE.vaccine);
      await deleteDialog.verifyTitle('Delete immunization order');
      await deleteDialog.verifyMessage('Are you sure you want to delete the immunization order?');
      await deleteDialog.clickProceedButton();
      await marTab.verifyVaccinePresent({
        ...EDITED_VACCINE,
        status: CANCELLED,
      });
    });
  });

  test('Administering immunization order happy path', async () => {
    await test.step('Verify vaccine order on vaccine details page, Administer order and verify', async () => {
      const vaccineDetailsTab = await createOrderForAdministration(page, ADMINISTERED_VACCINE);
      const administrationConfirmationDialog = await vaccineDetailsTab.clickAdministeredButton();
      await administrationConfirmationDialog.verifyTitle('Order Administered');
      await administrationConfirmationDialog.verifyPatientName(resourceHandler.patient);
      await administrationConfirmationDialog.verifyVaccine(ADMINISTERED_VACCINE);
      await administrationConfirmationDialog.verifyMessage(
        'Please confirm that you want to mark this immunization order as Administered.'
      );
      await administrationConfirmationDialog.clickMarkAsAdministeredButton();
      const marTab = await vaccineDetailsTab.clickMarTab();
      await marTab.verifyVaccinePresent({
        ...ADMINISTERED_VACCINE,
        givenPerson: await getCurrentPractitionerName(),
        status: ADMINISTERED,
      });
    });

    await test.step('Verify immunization details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyVaccine(ADMINISTERED_VACCINE);
    });
  });

  test('Partly Administering immunization order happy path', async () => {
    await test.step('Verify vaccine order on vaccine details page, Partly Administer order and verify', async () => {
      const vaccineDetailsTab = await createOrderForAdministration(page, PARTLY_ADMINISTERED_VACCINE);
      const administrationConfirmationDialog = await vaccineDetailsTab.clickPartlyAdministeredButton();
      await administrationConfirmationDialog.verifyTitle('Order Partly Administered');
      await administrationConfirmationDialog.verifyPatientName(resourceHandler.patient);
      await administrationConfirmationDialog.verifyVaccine(PARTLY_ADMINISTERED_VACCINE);
      await administrationConfirmationDialog.verifyMessage(
        'Please confirm that you want to mark this immunization order as Partly Administered and select the reason.'
      );
      await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
      await administrationConfirmationDialog.clickMarkAsAdministeredButton();
      const marTab = await vaccineDetailsTab.clickMarTab();
      await marTab.verifyVaccinePresent({
        ...PARTLY_ADMINISTERED_VACCINE,
        givenPerson: await getCurrentPractitionerName(),
        status: PARTLY_ADMINISTERED,
        reason: PATIENT_REFUSED,
      });
    });

    await test.step('Verify immunization details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyVaccine(PARTLY_ADMINISTERED_VACCINE);
    });
  });

  test('Immunization happy path for making order not administered', async () => {
    const vaccineDetailsTab = await createOrderForAdministration(page, NOT_ADMINISTERED_VACCINE);
    const administrationConfirmationDialog = await vaccineDetailsTab.clickNotAdministeredButton();
    await administrationConfirmationDialog.verifyTitle('Order Not Administered');
    await administrationConfirmationDialog.verifyPatientName(resourceHandler.patient);
    await administrationConfirmationDialog.verifyVaccine(NOT_ADMINISTERED_VACCINE);
    await administrationConfirmationDialog.verifyMessage(
      'Please confirm that you want to mark this immunization order as Not Administered and select the reason.'
    );
    await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
    await administrationConfirmationDialog.clickMarkAsAdministeredButton();
    const marTab = await vaccineDetailsTab.clickMarTab();
    await marTab.verifyVaccinePresent({
      ...NOT_ADMINISTERED_VACCINE,
      status: NOT_ADMINISTERED,
      reason: PATIENT_REFUSED,
    });
  });

  async function setupPractitioners(page: Page): Promise<void> {
    const inPersonHeader = new InPersonHeader(page);
    await page.goto(`in-person/${resourceHandler.appointment.id}/review-and-sign`);
    await inPersonHeader.verifyStatus('pending');
    await inPersonHeader.selectIntakePractitioner();
    await inPersonHeader.selectProviderPractitioner();
    const sideMenu = new SideMenu(page);
    await sideMenu.clickCcAndIntakeNotes();
  }

  async function setupDiagnosis(page: Page): Promise<void> {
    const sideMenu = new SideMenu(page);
    const assessmentPage = await sideMenu.clickAssessment();
    await assessmentPage.expectDiagnosisDropdown();
    const firstDiagnosisSaved = waitForSaveChartDataResponse(
      page,
      (json) =>
        json.chartData.diagnosis?.some((dx) => dx.code.toLowerCase().includes(DIAGNOSIS_CODE_ONE.toLowerCase())) ??
        false
    );
    await assessmentPage.selectDiagnosis({ diagnosisCode: DIAGNOSIS_CODE_ONE });
    await firstDiagnosisSaved;
    const secondDiagnosisSaved = waitForSaveChartDataResponse(
      page,
      (json) =>
        json.chartData.diagnosis?.some((dx) => dx.code.toLowerCase().includes(DIAGNOSIS_CODE_TWO.toLowerCase())) ??
        false
    );
    await assessmentPage.selectDiagnosis({ diagnosisCode: DIAGNOSIS_CODE_TWO });
    await secondDiagnosisSaved;
  }

  async function enterVaccineInfo(vaccineInfo: VaccineInfo, orderDetailsSection: OrderDetailsSection): Promise<void> {
    await orderDetailsSection.selectVaccine(vaccineInfo.vaccine);
    await orderDetailsSection.enterDose(vaccineInfo.dose);
    await orderDetailsSection.selectUnits(vaccineInfo.units);
    await orderDetailsSection.selectRoute(vaccineInfo.route);
    await orderDetailsSection.selectLocation(vaccineInfo.location);
    await orderDetailsSection.enterInstructions(vaccineInfo.instructions);
    await orderDetailsSection.enterManufacturer(vaccineInfo.manufacturer);
    await orderDetailsSection.selectAssociatedDx(vaccineInfo.associatedDx);
  }

  async function verifyVaccineInfo(vaccineInfo: VaccineInfo, orderDetailsSection: OrderDetailsSection): Promise<void> {
    await orderDetailsSection.verifyVaccine(vaccineInfo.vaccine);
    await orderDetailsSection.verifyDose(vaccineInfo.dose);
    await orderDetailsSection.verifyUnits(vaccineInfo.units);
    await orderDetailsSection.verifyRoute(vaccineInfo.route);
    await orderDetailsSection.verifyLocation(vaccineInfo.location);
    await orderDetailsSection.verifyInstructions(vaccineInfo.instructions);
    await orderDetailsSection.verifyManufacturer(vaccineInfo.manufacturer);
    await orderDetailsSection.verifyAssociatedDx(vaccineInfo.associatedDx);
  }

  async function enterAdministrationDetails(
    administrationDetails: AdministrationDetails,
    vaccineDetailsPage: VaccineDetailsTab
  ): Promise<void> {
    await vaccineDetailsPage.enterLotNumber(administrationDetails.lotNumber);
    await vaccineDetailsPage.enterExpiredDate(administrationDetails.expiredDate);
    await vaccineDetailsPage.enterMvxCode(administrationDetails.mvxCode);
    await vaccineDetailsPage.enterCvxCode(administrationDetails.cvxCode);
    await vaccineDetailsPage.selectCptCode(administrationDetails.cptCode);
    await vaccineDetailsPage.enterNdcCode(administrationDetails.ndcCode);
    await vaccineDetailsPage.enterAdministeredDate(administrationDetails.administeredDate);
    await vaccineDetailsPage.enterAdministeredTime(administrationDetails.administeredTime);
    await vaccineDetailsPage.setVisCheckboxChecked(true);
    await vaccineDetailsPage.enterVisGivenDate(administrationDetails.visGivenDate);
    await vaccineDetailsPage.selectRelationship(administrationDetails.relationship);
    await vaccineDetailsPage.enterFullName(administrationDetails.fullName);
    await vaccineDetailsPage.enterMobile(administrationDetails.mobile);
  }

  async function getCurrentPractitionerName(): Promise<string> {
    const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
    return getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner);
  }

  async function createOrderForAdministration(page: Page, vaccineInfo: VaccineInfo): Promise<VaccineDetailsTab> {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await enterVaccineInfo(vaccineInfo, createOrderPage.orderDetailsSection);
    await createOrderPage.clickConfirmationButton();
    const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    const vaccineDetailsTab = await immunizationPage.clickVaccineDetailsTab();
    await verifyVaccineInfo(vaccineInfo, vaccineDetailsTab.orderDetailsSection);
    await enterAdministrationDetails(ADMINISTRATION_DETAILS, vaccineDetailsTab);
    return vaccineDetailsTab;
  }
});
