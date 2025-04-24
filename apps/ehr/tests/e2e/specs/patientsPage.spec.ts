import { test } from '@playwright/test';
import {
  PATIENT_BIRTH_DATE_SHORT,
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
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test('Search patients with different filters', async ({ page }) => {
  await page.goto('/patients');

  await test.step('Search by Last name', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Date of birth', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Phone number', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Address', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByAddress(PATIENT_LINE.substring(0, 6));
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Email', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByEmail(PATIENT_EMAIL.split('@')[0]);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Last name and First name', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Last name and Date of birth', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Last name and Address', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByAddress(PATIENT_CITY);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Last name and Phone number', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Search by Last name, First name and Date of birth', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      id: resourceHandler.patient.id!,
      firstName: PATIENT_FIRST_NAME,
      lastName: PATIENT_LAST_NAME,
      dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
      email: PATIENT_EMAIL,
      phoneNumber: PATIENT_PHONE_NUMBER,
      address: PATIENT_LINE + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
    });
    await page.goto('/patients');
  });

  await test.step('Reset filters', async () => {
    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.searchByAddress(PATIENT_CITY);
    await patientsPage.searchByEmail(PATIENT_EMAIL.split('@')[0]);
    await patientsPage.clickResetFiltersButton();
    await patientsPage.verifyFilterReset();
  });
});
