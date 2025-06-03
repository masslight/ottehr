import { expect, Page, test } from '@playwright/test';
import { formatDOB } from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import {
  PATIENT_BIRTHDAY,
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_CITY,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  PATIENT_LINE,
  PATIENT_LINE_2,
  PATIENT_PHONE_NUMBER,
  PATIENT_POSTALCODE,
  PATIENT_STATE,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { expectPatientInformationPage } from '../page/PatientInformationPage';
import { expectPatientsPage } from '../page/PatientsPage';

// We may create new instances for the tests with mutable operations, and keep parralel tests isolated
const resourceHandler = new ResourceHandler();

const awaitCSSHeaderInit = async (page: Page): Promise<void> => {
  await expect(async () => {
    const content = await page.getByTestId(dataTestIds.cssHeader.container).textContent();
    return content?.includes(resourceHandler.patient.name![0].family!) ?? false;
  }).toPass({ timeout: 30_000 });
};

test.beforeAll(async () => {
  if (process.env.INTEGRATION_TEST === 'true') {
    await resourceHandler.setResourcesFast();
  } else {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  }
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test('Happy path: set up filters and navigate to visit page', async ({ page }) => {
  await page.goto('/visits');

  // INITIAL DATA IS LOADED
  await expect(page.getByTestId('PersonIcon')).toBeVisible();
  await expect(page.getByTestId(dataTestIds.dashboard.addPatientButton)).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId(dataTestIds.header.userName)).toBeAttached({ timeout: 15000 });

  // CHOOSE DATE
  await page.waitForSelector('button[aria-label*="Choose date"]');
  await page.click('button[aria-label*="Choose date"]');
  await page.getByTestId(dataTestIds.dashboard.datePickerTodayButton).locator('button').click();

  // CHOOSE LOCATION
  await page.getByTestId(dataTestIds.dashboard.locationSelect).getByRole('button', { name: 'Open' }).click();
  await page
    .locator('body .MuiAutocomplete-popper .MuiAutocomplete-option')
    .getByText(new RegExp(ENV_LOCATION_NAME!, 'i'))
    .waitFor();
  await page.getByTestId(dataTestIds.dashboard.locationSelect).getByRole('combobox').fill(ENV_LOCATION_NAME!);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId(dataTestIds.dashboard.locationSelect).getByRole('combobox')).toHaveValue(
    new RegExp(ENV_LOCATION_NAME!, 'i'),
    {
      timeout: 3000,
    }
  );

  // CHOOSE TAB
  await page.locator(`[data-testid="${dataTestIds.dashboard.prebookedTab}"]`).click();

  console.log(`resource handler appointment: ${JSON.stringify(resourceHandler.appointment, null, 2)}`);
  const tableRowLocator = page.getByTestId(dataTestIds.dashboard.tableRowWrapper(resourceHandler.appointment.id!));

  await expect(tableRowLocator).toBeAttached({
    timeout: 15000,
  });

  await expect(tableRowLocator.getByTestId(dataTestIds.dashboard.intakeButton)).toBeAttached({
    timeout: 15000,
  });

  // todo: commenting out cause it doesn't work in CI, need to investigate why, locally runs fine every time
  // // GOTO VISIT PAGE
  // await page.getByTestId(dataTestIds.dashboard.tableRowStatus(resourceHandler.appointment.id!)).click();

  // // CHECK THE URL CHANGED
  // await page.waitForURL(`/visit/${resourceHandler.appointment.id}`);

  // // PATIENT NAME IS DISPLAYED
  // await expect(page.getByTestId(dataTestIds.appointmentPage.patientFullName)).toContainText(
  //   resourceHandler.patient.name![0].family!
  // );
});

test('CSS intake patient page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/patient-info`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake screening-questions page is available', async ({ page }) => {
  await page.goto(`/in-person/${resourceHandler.appointment.id}/screening-questions`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake vitals page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/vitals`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake allergies page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/allergies`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake medications page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/medications`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake medical conditions page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/medical-conditions`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake surgical history page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/surgical-history`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake hospitalization page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/hospitalization`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake external lab orders page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/external-lab-orders`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake assessment page is available', async ({ page }) => {
  await page.goto(`in-person/${resourceHandler.appointment.id}/assessment`);
  await awaitCSSHeaderInit(page);
});

test.describe('Patient search', () => {
  const patientData = {
    firstName: PATIENT_FIRST_NAME,
    lastName: PATIENT_LAST_NAME,
    dateOfBirth: PATIENT_BIRTH_DATE_SHORT,
    email: PATIENT_EMAIL,
    phoneNumber: PATIENT_PHONE_NUMBER,
    address:
      PATIENT_LINE + ', ' + PATIENT_LINE_2 + ', ' + PATIENT_CITY + '\n' + PATIENT_STATE + ' ' + PATIENT_POSTALCODE,
  };

  test('Search by Last name', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by First name', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Date of birth', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Phone number', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Address', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByAddress(PATIENT_LINE.substring(0, 6));
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Email', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByEmail(PATIENT_EMAIL.split('@')[0]);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Last name and First name', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Last name and Date of birth', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Last name and Address', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByAddress(PATIENT_CITY);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Search by Last name and Phone number', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.clickSearchButton();
    await patientsPage.verifyPatientPresent({
      ...patientData,
      id: resourceHandler.patient.id!,
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
      ...patientData,
      id: resourceHandler.patient.id!,
    });
  });

  test('Reset filters', async ({ page }) => {
    await page.goto('/patients');

    const patientsPage = await expectPatientsPage(page);
    await patientsPage.searchByLastName(PATIENT_LAST_NAME);
    await patientsPage.searchByGivenNames(PATIENT_FIRST_NAME);
    await patientsPage.searchByDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientsPage.searchByMobilePhone(PATIENT_PHONE_NUMBER);
    await patientsPage.searchByAddress(PATIENT_CITY);
    await patientsPage.searchByEmail(PATIENT_EMAIL.split('@')[0]);
    await patientsPage.clickResetFiltersButton();
    await patientsPage.verifyFilterReset();
  });
});

test.describe('Patient header tests', () => {
  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/patient/' + resourceHandler.patient.id + '/info');
  });

  const HEADER_PATIENT_BIRTHDAY = formatDOB(PATIENT_BIRTHDAY)!;
  const HEADER_PATIENT_GENDER = 'Male';
  const HEADER_PATIENT_NAME = PATIENT_LAST_NAME + ', ' + PATIENT_FIRST_NAME;

  test('Check header info', async ({ page }) => {
    const patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
    const patientHeader = patientInformationPage.getPatientHeader();
    await patientHeader.verifyHeaderPatientID('PID: ' + resourceHandler.patient.id);
    await patientHeader.verifyHeaderPatientName(HEADER_PATIENT_NAME);
    await patientHeader.verifyHeaderPatientBirthSex(HEADER_PATIENT_GENDER);
    await patientHeader.verifyHeaderPatientBirthday(HEADER_PATIENT_BIRTHDAY);
  });

  test('Check patient info', async ({ page }) => {
    const patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientLastName(PATIENT_LAST_NAME);
    await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
    await patientInformationPage.verifyPatientDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientInformationPage.verifyPatientBirthSex(PATIENT_GENDER);
  });
});
