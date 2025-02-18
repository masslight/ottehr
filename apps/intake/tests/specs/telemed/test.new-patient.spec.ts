import { BrowserContext, expect, Page, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { UploadImage } from '../../utils/in-person/UploadImage';
import { FillingInfo } from '../../utils/telemed/FillingInfo';
import { Paperwork } from '../../utils/telemed/Paperwork';

enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
}

let context: BrowserContext;
let page: Page;
let fillingInfo: FillingInfo;
let paperwork: Paperwork;

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
  fillingInfo = new FillingInfo(page);
  paperwork = new Paperwork(page);

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

  await page.getByRole('heading', { name: 'Different family member' }).click();

  await clickContinue(page);

  await selectState(page);

  await expect(page.getByText('About the patient')).toBeVisible();

  await expect(page.getByPlaceholder('First name')).toBeVisible();

  patientInfo = await fillingInfo.fillNewPatientInfo();

  dob = await fillingInfo.fillDOBless18();

  await page.getByRole('button', { name: 'Continue' }).click();

  await paperwork.fillAndCheckContactInformation(patientInfo);

  await clickContinue(page);
});

test('Should display new patient in patients list', async () => {
  await page.goto('/select-patient');

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

// TODO: Fix the test, it should not be dependent on some resources that are pre-created at some moment
// right now there is possible condition when another appointment is in the status that causes a "Return to call" button
// to appear which has higher priority than "Continue Virtual Visit Request" button
test.skip('Should display Continue visit and Cancel request buttons', async () => {
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
  await paperwork.fillAndCheckContactInformation(patientInfo);
});

test('Should fill in patient details', async () => {
  await clickContinue(page);

  await paperwork.fillAndCheckPatientDetails();
});

test('Should fill in current medications as empty', async () => {
  await clickContinue(page);
  await clickContinue(page); // skip page with no required fields

  await paperwork.fillAndCheckEmptyCurrentMedications();
});

test('Should fill in current allergies as empty', async () => {
  await clickContinue(page);

  await paperwork.fillAndCheckEmptyCurrentAllergies();
});

test('Should fill in medical history as empty', async () => {
  await clickContinue(page);

  await paperwork.fillAndCheckEmptyMedicalHistory();
});

test('Should fill in surgical history as empty', async () => {
  await clickContinue(page);

  await paperwork.fillAndCheckEmptySurgicalHistory();
});

test('Should fill in payment option as self-pay', async () => {
  await clickContinue(page);
  await clickContinue(page); // skip page with no required fields

  await paperwork.fillAndCheckSelfPay();
});

test('Skip optional Photo ID', async () => {
  await clickContinue(page);
});

test('Fill patient conditions', async () => {
  await clickContinue(page);
});

test('Should fill school or work note as none', async () => {
  await paperwork.fillAndCheckSchoolWorkNoteAsNone();
});

test('Should fill consent forms', async () => {
  await clickContinue(page);

  await paperwork.fillAndCheckConsentForms();
});

test('Should not invite anyone', async () => {
  await clickContinue(page);

  await paperwork.fillAndCheckNoInviteParticipant();
});

test('Should go to waiting room', async () => {
  await clickContinue(page);
  await page.getByRole('button', { name: 'Go to the Waiting Room' }).click();
  await expect(page.getByText('Please wait, call will start automatically.')).toBeVisible({ timeout: 30000 });
});

test('Should check photo upload feature', async () => {
  const uploadPhotoButton = page.getByText('Upload photo');
  await expect(uploadPhotoButton).toBeVisible();
  await expect(page.getByText('No photo uploaded')).toBeVisible();
  await uploadPhotoButton.click();
  await expect(page.getByText('Patient condition photo')).toBeVisible();

  const uploadPhoto = new UploadImage(page);
  await uploadPhoto.fillPatientCondition();
  await page.getByText('Save').click();

  await expect(page.getByText('Photo attached')).toBeVisible();
  await uploadPhotoButton.click();
  await expect(page.getByText('We already have this! It was saved on')).toBeVisible();
});
