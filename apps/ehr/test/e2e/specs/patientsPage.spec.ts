import { test } from '@playwright/test';
import {
  PATIENT_CITY,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_LAST_NAME,
  PATIENT_LINE,
  PATIENT_PHONE_NUMBER,
  PATIENT_POSTALCODE,
  PATIENT_STATE,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { expectPatientsPage } from '../page/PatientsPage';

const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/patients');
});

test('Search by Last name', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME);
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Date of birth', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByDateOfBirth('01/01/2024');
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Phone number', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Address', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByAddress('Coop');
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Email', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByEmail('doe');
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Last name and First name', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME + ',' + PATIENT_FIRST_NAME);
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Last name and Date of birth', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME);
  await patientsPage.searchByDateOfBirth('01/01/2024');
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Last name and Address', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME);
  await patientsPage.searchByAddress('New York');
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Last name and Phone number', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME);
  await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Search by Last name, First name and Date of birth', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME + ',' + PATIENT_FIRST_NAME);
  await patientsPage.searchByDateOfBirth('01/01/2024');
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    PATIENT_EMAIL,
    '+1' + PATIENT_PHONE_NUMBER,
    PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE
  );
});

test('Reset filters', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME);
  await patientsPage.searchByDateOfBirth('01/01/2024');
  await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
  await patientsPage.searchByAddress('New York');
  await patientsPage.searchByEmail('doe');
  await patientsPage.clickResetFiltersButton();
  await patientsPage.verifyFilterReset();
});
