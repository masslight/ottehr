import { Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  expectEditVaccineOrderPage,
  openCreateVaccineOrderPage,
} from 'tests/e2e/page/in-person/Immunization/EditVaccineOrderPage';
import { openImmunizationPage } from 'tests/e2e/page/in-person/Immunization/ImmunizationPage';
import { OrderDetailsSection } from 'tests/e2e/page/in-person/Immunization/OrderDetailsSection';
import { VaccineDetailsPage } from 'tests/e2e/page/in-person/Immunization/VaccineDetailsPage';
import {
  InPersonProgressNotePage,
  openInPersonProgressNotePage,
} from 'tests/e2e/page/in-person/InPersonProgressNotePage';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { getFirstName, getLastName } from 'utils';
import vaccines from '../../../../../../config/oystehr/vaccines.json' assert { type: 'json' };

interface VaccineInfo {
  vaccine: string;
  dose: string;
  units: string;
  route: string;
  location: string;
  instructions: string;
}

interface AdministrationDetails {
  lotNumber: string;
  expiredDate: string;
  mvxCode: string;
  cvxCode: string;
  ndcCode: string;
  cptCode: string;
  adminiosteredDate: string;
  adminiosteredTime: string;
  visGivenDate: string;
  relationship: string;
  fullName: string;
  mobile: string;
}

const VACCINE_A: VaccineInfo = {
  vaccine: vaccines.fhirResources['VACCINE_TDAP'].resource.identifier[1].value,
  dose: '0.5',
  units: 'mg',
  route: 'Body cavity route (qualifier value)',
  location: 'Ear, Left',
  instructions: 'test vaccine instructions',
};

const VACCINE_B: VaccineInfo = {
  vaccine: vaccines.fhirResources['VACCINE_TD'].resource.identifier[1].value,
  dose: '1',
  units: 'mL',
  route: 'Caudal route (qualifier value)',
  location: 'Eye, Left',
  instructions: 'test vaccine instructions edited',
};

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
const NOT_ADMINISTRED = 'NOT-ADMINISTERED';
const CANCELLED = 'CANCELLED';
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

  test('Immunization create, edit and delete order happy path', async ({ page }) => {
    await test.step('Create a vaccine order and verify', async () => {
      const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
      await enterVaccineInfo(VACCINE_A, createOrderPage.orderDetailsSection);
      const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
      await createOrderPage.orderDetailsSection.verifyOrderedBy(
        getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner)
      );
      await createOrderPage.clickConfirmationButton();
      const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
      await immunizationPage.verifyVaccinePresent({
        ...VACCINE_A,
        orderedPerson: getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner),
        status: PENDING,
      });
      const editOrderPage = await immunizationPage.clickEditOrderButton(VACCINE_A.vaccine);
      await verifyVaccineInfo(VACCINE_A, editOrderPage.orderDetailsSection);
    });

    await test.step('Edit vaccine order and verify', async () => {
      let editOrderPage = await expectEditVaccineOrderPage(page);
      await enterVaccineInfo(VACCINE_B, editOrderPage.orderDetailsSection);
      await editOrderPage.clickConfirmationButton();
      const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
      await immunizationPage.verifyVaccinePresent({
        ...VACCINE_B,
        status: PENDING,
      });
      editOrderPage = await immunizationPage.clickEditOrderButton(VACCINE_B.vaccine);
      await verifyVaccineInfo(VACCINE_B, editOrderPage.orderDetailsSection);
    });

    await test.step('Delete the order and verify', async () => {
      const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
      const deleteDialog = await immunizationPage.clickDeleteButton(VACCINE_B.vaccine);
      await deleteDialog.verifyTitle('Delete vaccine order');
      await deleteDialog.verifyMessage('Are you sure you want to delete the vaccine order?');
      await deleteDialog.clickProceedButton();
      await immunizationPage.verifyVaccinePresent({
        ...VACCINE_B,
        status: CANCELLED,
      });
    });
  });

  test('Administering immunization order happy path', async ({ page }) => {
    await test.step('Create vaccine order', async () => {
      const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
      await enterVaccineInfo(VACCINE_A, createOrderPage.orderDetailsSection);
      await createOrderPage.clickConfirmationButton();
    });

    await test.step('Verify vaccine order on vaccine details page, Administer order and verify', async () => {
      const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
      const vaccineDetailsPage = await immunizationPage.clickVaccineDetailsTab();
      const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
      await verifyVaccineInfo(VACCINE_A, vaccineDetailsPage.orderDetailsSection);
      await enterAdministrationDetails(ADMINISTRATION_DETAILS, vaccineDetailsPage);
      const administrationConfirmationDialog = await vaccineDetailsPage.clickAdministeredButton();
      await administrationConfirmationDialog.verifyTitle('Order Administered');
      await administrationConfirmationDialog.verifyPatientName(
        'Patient: ' + resourceHandler.patient?.name?.[0]?.family + ', ' + resourceHandler.patient?.name?.[0]?.given?.[0]
      );
      await administrationConfirmationDialog.verifyVaccine(
        'Vaccine: ' + VACCINE_A.vaccine + ' / ' + VACCINE_A.dose + VACCINE_A.units + ' / ' + VACCINE_A.route
      );
      await administrationConfirmationDialog.verifyMessage(
        'Please confirm that you want to mark this immunization order as Administered.'
      );
      await administrationConfirmationDialog.clickMarkAsAdministeredButton();
      await immunizationPage.clickMarTab();
      await immunizationPage.verifyVaccinePresent({
        ...VACCINE_A,
        givenPerson: getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner),
        status: ADMINISTERED,
      });
    });
    await test.step('Verify immunization details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyVaccine(VACCINE_A);
    });
  });

  test('Partly Administering immunization order happy path', async ({ page }) => {
    await test.step('Verify vaccine order on vaccine details page, Partly Administer order and verify', async () => {
      const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
      await enterVaccineInfo(VACCINE_A, createOrderPage.orderDetailsSection);
      const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
      await createOrderPage.clickConfirmationButton();

      const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
      const vaccineDetailsPage = await immunizationPage.clickVaccineDetailsTab();
      await verifyVaccineInfo(VACCINE_A, createOrderPage.orderDetailsSection);
      await enterAdministrationDetails(ADMINISTRATION_DETAILS, vaccineDetailsPage);
      const administrationConfirmationDialog = await vaccineDetailsPage.clickPartlyAdministeredButton();
      await administrationConfirmationDialog.verifyTitle('Order Partly Administered');
      await administrationConfirmationDialog.verifyPatientName(
        'Patient: ' + resourceHandler.patient?.name?.[0]?.family + ', ' + resourceHandler.patient?.name?.[0]?.given?.[0]
      );
      await administrationConfirmationDialog.verifyVaccine(
        'Vaccine: ' + VACCINE_A.vaccine + ' / ' + VACCINE_A.dose + VACCINE_A.units + ' / ' + VACCINE_A.route
      );
      await administrationConfirmationDialog.verifyMessage(
        'Please confirm that you want to mark this immunization order as Partly Administered and select the reason.'
      );
      await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
      await administrationConfirmationDialog.clickMarkAsAdministeredButton();
      await immunizationPage.clickMarTab();
      await immunizationPage.verifyVaccinePresent({
        ...VACCINE_A,
        givenPerson: getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner),
        status: PARTLY_ADMINISTERED,
        reason: PATIENT_REFUSED,
      });
    });
    await test.step('Verify immunization details on progress note', async () => {
      const progressNotePage = await openInPersonProgressNotePage(resourceHandler.appointment.id!, page);
      await progressNotePage.verifyVaccine(VACCINE_A);
    });
  });

  test('Immunization happy path for making order not administered', async ({ page }) => {
    const createOrderPage = await openCreateVaccineOrderPage(resourceHandler.appointment.id!, page);
    await enterVaccineInfo(VACCINE_A, createOrderPage.orderDetailsSection);
    await createOrderPage.clickConfirmationButton();
    const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
    const immunizationPage = await openImmunizationPage(resourceHandler.appointment.id!, page);
    const vaccineDetailsPage = await immunizationPage.clickVaccineDetailsTab();
    await verifyVaccineInfo(VACCINE_A, createOrderPage.orderDetailsSection);
    await enterAdministrationDetails(ADMINISTRATION_DETAILS, vaccineDetailsPage);
    const administrationConfirmationDialog = await vaccineDetailsPage.clickNotAdministeredButton();
    await administrationConfirmationDialog.verifyTitle('Order Not Administered');
    await administrationConfirmationDialog.verifyPatientName(
      'Patient: ' + resourceHandler.patient?.name?.[0]?.family + ', ' + resourceHandler.patient?.name?.[0]?.given?.[0]
    );
    await administrationConfirmationDialog.verifyVaccine(
      'Vaccine: ' + VACCINE_A.vaccine + ' / ' + VACCINE_A.dose + VACCINE_A.units + ' / ' + VACCINE_A.route
    );
    await administrationConfirmationDialog.verifyMessage(
      'Please confirm that you want to mark this immunization order as Not Administered and select the reason.'
    );
    await administrationConfirmationDialog.selectReason(PATIENT_REFUSED);
    await administrationConfirmationDialog.clickMarkAsAdministeredButton();
    await immunizationPage.clickMarTab();
    await immunizationPage.verifyVaccinePresent({
      ...VACCINE_A,
      givenPerson: getFirstName(testUserPractitioner) + ' ' + getLastName(testUserPractitioner),
      status: NOT_ADMINISTRED,
      reason: PATIENT_REFUSED,
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

  async function enterVaccineInfo(vaccineInfo: VaccineInfo, orderDetailsSection: OrderDetailsSection): Promise<void> {
    await orderDetailsSection.selectVaccine(vaccineInfo.vaccine);
    await orderDetailsSection.enterDose(vaccineInfo.dose);
    await orderDetailsSection.selectUnits(vaccineInfo.units);
    await orderDetailsSection.selectRoute(vaccineInfo.route);
    await orderDetailsSection.selectLocation(vaccineInfo.location);
    await orderDetailsSection.enterInstructions(vaccineInfo.instructions);
  }

  async function verifyVaccineInfo(vaccineInfo: VaccineInfo, orderDetailsSection: OrderDetailsSection): Promise<void> {
    await orderDetailsSection.verifyVaccine(vaccineInfo.vaccine);
    await orderDetailsSection.verifyDose(vaccineInfo.dose);
    await orderDetailsSection.verifyUnits(vaccineInfo.units);
    await orderDetailsSection.verifyRoute(vaccineInfo.route);
    await orderDetailsSection.verifyLocation(vaccineInfo.location);
    await orderDetailsSection.verifyInstructions(vaccineInfo.instructions);
  }

  async function enterAdministrationDetails(
    administrationDetails: AdministrationDetails,
    vaccineDetailsPage: VaccineDetailsPage
  ): Promise<void> {
    await vaccineDetailsPage.enterLotNumber(administrationDetails.lotNumber);
    await vaccineDetailsPage.enterExpiredDate(administrationDetails.expiredDate);
    await vaccineDetailsPage.enterMvxCode(administrationDetails.mvxCode);
    await vaccineDetailsPage.enterCvxCode(administrationDetails.cvxCode);
    await vaccineDetailsPage.selectCptCode(administrationDetails.cptCode);
    await vaccineDetailsPage.enterNdcCode(administrationDetails.ndcCode);
    await vaccineDetailsPage.enterAdministeredDate(administrationDetails.adminiosteredDate);
    await vaccineDetailsPage.enterAdministeredTime(administrationDetails.adminiosteredTime);
    await vaccineDetailsPage.setVisCheckboxChecked(true);
    await vaccineDetailsPage.enterVisGivenDate(administrationDetails.visGivenDate);
    await vaccineDetailsPage.selectRelationship(administrationDetails.relationship);
    await vaccineDetailsPage.enterFullName(administrationDetails.fullName);
    await vaccineDetailsPage.enterMobile(administrationDetails.mobile);
  }
});
