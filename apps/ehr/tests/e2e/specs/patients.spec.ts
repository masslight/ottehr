import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { formatDOB, PATIENT_RECORD_CONFIG } from 'utils';
import {
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_BIRTHDAY,
  PATIENT_CITY,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  PATIENT_LINE,
  PATIENT_LINE_2,
  PATIENT_PHONE_NUMBER,
  PATIENT_POSTAL_CODE,
  PATIENT_STATE,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { expectPatientInformationPage, PatientInformationPage } from '../page/PatientInformationPage';
import { expectPatientsPage } from '../page/PatientsPage';

const patientSummary = PATIENT_RECORD_CONFIG.FormFields.patientSummary.items;

// We may create new instances for the tests with mutable operations, and keep parallel tests isolated
const PROCESS_ID = `patients.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID);

test.beforeAll(async () => {
  await resourceHandler.setResources({ skipPaperwork: true });
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.describe('Patient search', { tag: '@flaky' }, () => {
  const patientData = {
    firstName: PATIENT_FIRST_NAME,
    lastName: PATIENT_LAST_NAME,
    dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
    email: PATIENT_EMAIL,
    phoneNumber: PATIENT_PHONE_NUMBER,
    address:
      PATIENT_LINE + ', ' + PATIENT_LINE_2 + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTAL_CODE,
  };

  test('Search by Last name', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      lastName: PATIENT_LAST_NAME,
    });
  });

  test('Search by First name', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      firstName: PATIENT_FIRST_NAME,
    });
  });

  test('Search by Date of birth', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
    });
  });

  test('Search by Phone number', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      phoneNumber: PATIENT_PHONE_NUMBER,
    });
  });

  test.skip('Search by Address', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByAddress(PATIENT_LINE.substring(0, 6));
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      address: patientData.address,
    });
  });

  test('Search by Email', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByEmail(PATIENT_EMAIL);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      email: PATIENT_EMAIL,
    });
  });

  test('Search by Last name and First name', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
    });
  });

  test('Search by Last name and Date of birth', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
    });
  });

  test('Search by Last name and Address', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByAddress(PATIENT_CITY);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      lastName: PATIENT_LAST_NAME,
      address: patientData.address,
    });
  });

  test('Search by Last name and Phone number', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      lastName: PATIENT_LAST_NAME,
      phoneNumber: PATIENT_PHONE_NUMBER,
    });
  });

  test('Search by Last name, First name and Date of birth', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      lastName: PATIENT_LAST_NAME,
      firstName: PATIENT_FIRST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
    });

    await test.step('Reset filters', async () => {
      await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
      await patientsPage.searchByAddress(PATIENT_CITY);
      await patientsPage.searchByEmail(PATIENT_EMAIL);
      await patientsPage.clickResetFiltersButton();
      await patientsPage.verifyFilterReset();
    });
  });
});

test.describe('Patient header tests', () => {
  let patientInformationPage: PatientInformationPage;
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/patient/' + resourceHandler.patient.id + '/info');
    patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test.describe.configure({ mode: 'serial' });

  const HEADER_PATIENT_BIRTHDAY = formatDOB(PATIENT_BIRTHDAY)!;
  const HEADER_PATIENT_GENDER = 'Male';
  const HEADER_PATIENT_NAME = PATIENT_LAST_NAME + ', ' + PATIENT_FIRST_NAME;

  test('Check header info', async () => {
    const patientHeader = patientInformationPage.getPatientHeader();
    await patientHeader.verifyHeaderPatientID('PID: ' + resourceHandler.patient.id);
    await patientHeader.verifyHeaderPatientName(HEADER_PATIENT_NAME);
    await patientHeader.verifyHeaderPatientBirthSex(HEADER_PATIENT_GENDER);
    await patientHeader.verifyHeaderPatientBirthday(HEADER_PATIENT_BIRTHDAY);
  });

  test('Check patient info', async () => {
    await patientInformationPage.verifyTextFieldValue(patientSummary.lastName.key, PATIENT_LAST_NAME);
    await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, PATIENT_FIRST_NAME);
    await patientInformationPage.verifyDateFieldValue(patientSummary.birthDate.key, PATIENT_BIRTH_DATE_SHORT);
    await patientInformationPage.verifySelectFieldValue(patientSummary.birthSex.key, PATIENT_GENDER);
  });
});
