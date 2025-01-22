import { BrowserContext, expect, Page, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { FillingInfo } from '../../utils/telemed/FillingInfo';
import { Paperwork } from '../../utils/telemed/Paperwork';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { DIFFERENT_FAMILY_MEMBER_DATA } from '../../../src/telemed/utils/constants';

enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
}

let context: BrowserContext;
let page: Page;

let patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined;
let dob: Awaited<ReturnType<FillingInfo['fillDOBless18']>> | undefined;

const appointmentIds: string[] = [];

const clickContinue = async (page: Page, awaitNavigation = true): Promise<unknown> => {
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 10000 });
  const currentPath = new URL(page.url()).pathname;
  if (awaitNavigation) {
    return await Promise.all([
      page.waitForURL((url) => url.pathname !== currentPath),
      page.getByRole('button', { name: 'Continue' }).click(),
    ]);
  } else {
    return await page.getByRole('button', { name: 'Continue' }).click();
  }
};

const selectState = async (page: Page): Promise<void> => {
  await page.getByPlaceholder('Search or select').click();
  await page.getByRole('option', { name: 'California' }).click();
  await clickContinue(page);
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('/telemed-create-appointment/')) {
      const { appointmentId } = await response.json();
      if (appointmentId && !appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
    }
  });
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  const env = process.env.ENV;

  for (const appointmentId of appointmentIds) {
    console.log(`Deleting ${appointmentId} on env: ${env}`);
    await cleanAppointment(appointmentId, env!);
  }
});

test('Should create new patient', async () => {
  await page.goto('/home');

  await page.getByTestId(dataTestIds.startVirtualVisitButton).click();

  await page.getByRole('heading', { name: DIFFERENT_FAMILY_MEMBER_DATA.label }).click();

  await clickContinue(page);

  await selectState(page);

  await expect(page.getByText('About the patient')).toBeVisible();

  await expect(page.getByPlaceholder('First name')).toBeVisible();

  const fillingInfo = new FillingInfo(page);

  patientInfo = await fillingInfo.fillNewPatientInfo();

  dob = await fillingInfo.fillDOBless18();

  await page.getByRole('button', { name: 'Continue' }).click();

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckContactInformation(patientInfo);

  await clickContinue(page);
});

test('Should display new patient in patients list', async () => {
  await page.goto('/select-patient');

  const fillingInfo = new FillingInfo(page);

  const locator = page.getByText(`${patientInfo?.firstName} ${patientInfo?.lastName}`).locator('..');

  if (!dob?.randomMonth || !dob?.randomDay || !dob?.randomYear) {
    throw Error('Date units are not provided');
  }

  await expect(locator.getByText(`${patientInfo?.firstName} ${patientInfo?.lastName}`)).toBeVisible({
    timeout: 10000,
  });
  await expect(
    locator.getByText(
      `Birthday: ${fillingInfo.getStringDateByDateUnits(dob?.randomMonth, dob?.randomDay, dob?.randomYear)}`
    )
  ).toBeVisible();
});

test('Should display Continue visit and Cancel request buttons', async () => {
  await page.goto('/home');

  await expect(page.getByRole('button', { name: 'Continue Virtual Visit Request' })).toBeVisible({ timeout: 10000 });

  const cancelButton = page.getByRole('button', { name: 'Cancel this request' });
  await expect(cancelButton).toBeVisible();

  await cancelButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Why are you canceling?')).toBeVisible();
});

test('Should display correct patient info', async () => {
  await page.goto('/home');

  await page.getByTestId(dataTestIds.startVirtualVisitButton).click();

  const fillingInfo = new FillingInfo(page);

  const patientName = page.getByText(`${patientInfo?.firstName} ${patientInfo?.lastName}`);
  await patientName.click();
  await clickContinue(page);

  await selectState(page);

  await expect(page.getByText('About the patient')).toBeVisible({ timeout: 10000 });

  if (!dob?.randomMonth || !dob?.randomDay || !dob?.randomYear) {
    throw Error('Date units are not provided');
  }

  await expect(patientName).toBeVisible();
  await expect(
    page.getByText(
      `Birthday: ${fillingInfo.getStringDateByDateUnits(
        dob?.randomMonth,
        dob?.randomDay,
        dob?.randomYear,
        'MMM dd, yyyy'
      )}`
    )
  ).toBeVisible();
  await expect(
    page.getByText(`Birth sex: ${PersonSex[patientInfo?.birthSex as keyof typeof PersonSex]}`)
  ).toBeVisible();
  await expect(page.locator("input[type='text'][id='email']")).toHaveValue(patientInfo?.email || '');
});

test("Should fill in correct patient's DOB", async () => {
  await clickContinue(page);

  await expect(page.getByText(`Confirm ${patientInfo?.firstName}'s date of birth`)).toBeVisible();

  const fillingInfo = new FillingInfo(page);

  if (!dob?.randomMonth || !dob?.randomDay || !dob?.randomYear) {
    throw Error('Date units are not provided');
  }

  await fillingInfo.fillWrongDOB(dob?.randomMonth, dob?.randomDay, dob?.randomYear);
  await clickContinue(page, false);

  const errorText = await page
    .getByText('Unfortunately, this patient record is not confirmed.') // modal, in that case try again option should be selected
    .or(page.getByText('Date may not be in the future')) // validation error directly on the form
    .textContent();

  // close if it is modal
  if (errorText?.includes('Unfortunately, this patient record is not confirmed')) {
    await page.getByRole('button', { name: 'Try again' }).click();
  }

  await fillingInfo.fillCorrectDOB(dob?.randomMonth, dob?.randomDay, dob?.randomYear);
  await clickContinue(page);

  // todo use another way to get appointment id
  // await getAppointmentIdFromCreateAppointmentRequest(page);

  await expect(page.getByText('Contact information')).toBeVisible({ timeout: 15000 });
});

test('Should fill in contact information', async () => {
  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckContactInformation(patientInfo);
});

test('Should fill in patient details', async () => {
  await clickContinue(page);

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckPatientDetails();
});

test('Should fill in current medications as empty', async () => {
  await clickContinue(page);
  await clickContinue(page); // skip page with no required fields

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckEmptyCurrentMedications();
});

test('Should fill in current allergies as empty', async () => {
  await clickContinue(page);

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckEmptyCurrentAllergies();
});

test('Should fill in medical history as empty', async () => {
  await clickContinue(page);

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckEmptyMedicalHistory();
});

test('Should fill in surgical history as empty', async () => {
  await clickContinue(page);

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckEmptySurgicalHistory();
});

test('Should fill in payment option as self-pay', async () => {
  await clickContinue(page);
  await clickContinue(page); // skip page with no required fields

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckSelfPay();
});

test('Skip optional Photo ID', async () => {
  await clickContinue(page);
});

test('Fill patient conditions', async () => {
  await clickContinue(page);
});

test('Should fill school or work note as none', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.fillAndCheckSchoolWorkNoteAsNone();
});

test('Should fill consent forms', async () => {
  await clickContinue(page);

  const paperwork = new Paperwork(page);

  await paperwork.fillAndCheckConsentForms();
});

test('Should not invite anyone', async () => {
  await clickContinue(page);
  const paperwork = new Paperwork(page);
  await paperwork.fillAndCheckNoInviteParticipant();
});

test('Should go to waiting room', async () => {
  await clickContinue(page);
  await page.getByRole('button', { name: 'Go to the Waiting Room' }).click();
  await expect(page.getByText('Please wait, call will start automatically.')).toBeVisible({ timeout: 30000 });
});
