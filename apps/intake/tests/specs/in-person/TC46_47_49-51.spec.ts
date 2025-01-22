import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { UploadImage } from '../../utils/in-person/UploadImage';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';

test.describe.configure({ mode: 'parallel' });

test.describe.skip('TC46,47 and 49-51', () => {
  let PaperworkURL: string;
  let FilledfirstName: string;
  let FilledlastName: string;
  let FilledMiddleName: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const BookVisit = new BookPrebookVisit(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible({ timeout: 15000 });
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
    const bookingData = await BookVisit.bookNewPatientGT18yoAsParentFromPatientsScreen();
    FilledfirstName = bookingData.firstName;
    FilledlastName = bookingData.lastName;
    FilledMiddleName = bookingData.middleName;
    await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    PaperworkURL = page.url();
    console.log('Paperwork URL:', PaperworkURL);
  });
  test('TC47 Check content on Photo ID', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await fillingInfo.ResponsiblePartyLegalGuardian();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    await expect(page.getByText(`${FilledfirstName} ${FilledMiddleName} ${FilledlastName}`)).toBeVisible();
    await expect(
      page.getByText(
        "Please upload a picture of a Photo ID, Drivers License or Passport of the patient's legal guardian (ie: Patient or Parent/Guardian)"
      )
    ).toBeVisible();
    await expect(page.getByText('Take a picture of the front side of your Photo ID (optional)')).toBeVisible();
    await expect(page.getByText('Take a picture of the back side of your Photo ID (optional)')).toBeVisible();
    await expect(page.locator('[id^="photo-id-front"][id$="-description"]')).toHaveText(
      'Take a picture of the front side of your Photo ID and upload it here'
    );
    await expect(page.locator('[id^="photo-id-back"][id$="-description"]')).toHaveText(
      'Take a picture of the back side of your Photo ID and upload it here'
    );
  });
  test('TC46 Upload Photo ID', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const fillingInfo = new FillingInfo(page);
    const uploadPhoto = new UploadImage(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await fillingInfo.ResponsiblePartyLegalGuardian();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
    const uploadedFrontPhoto = await uploadPhoto.fillPhotoFrontID();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadPhoto.fillPhotoBackID();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(uploadedBackPhoto).toBeHidden();
    await uploadPhoto.fillPhotoFrontID();
    await uploadPhoto.fillPhotoBackID();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible({ timeout: 15000 });
    await backButton.click();
    const today = await fillingInfo.getToday();
    await expect(page.locator('#photo-id-front-description')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    await expect(page.locator('#photo-id-back-description')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    // await expect(reuploadedFrontPhoto).toBeVisible();
    // await expect(reuploadedBackPhoto).toBeVisible();
    await backButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await continueButton.click();
    await expect(page.locator('[id^="photo-id-front"][id$="-description"]')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    await expect(page.locator('[id^="photo-id-back"][id$="-description"]')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    // await expect(reuploadedFrontPhoto).toBeVisible();
    // await expect(reuploadedBackPhoto).toBeVisible();
  });
  test('TC50 Check content on Insurance details', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByLabel('I have insurance').check();
    await expect(page.getByText('We use this information to help determine your coverage and costs.')).toBeVisible();
    await expect(page.getByText('Insurance carrier *', { exact: true })).toBeVisible();
    await expect(page.getByText('Member ID *', { exact: true })).toBeVisible();
    //await expect(page.getByText('Cardholder details', { exact: true })).toBeVisible(); not used anymore
    await expect(page.getByText("Policy holder's first name *", { exact: true })).toBeVisible();
    await expect(page.getByText("Policy holder's last name *", { exact: true })).toBeVisible();
    await expect(page.getByText("Policy holder's date of birth *", { exact: true })).toBeVisible();
    await expect(page.getByText("Policy holder's birth sex *", { exact: true })).toBeVisible();
    await expect(page.getByText("Patient's relationship to insured *", { exact: true })).toBeVisible();
    //await expect(page.getByText('Additional insurance information (optional)', { exact: true })).toBeVisible();
    await expect(page.getByText('Front side of the insurance card (optional)', { exact: true })).toBeVisible();
    await expect(page.getByText('Back side of the insurance card (optional)', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Take a picture of the front side of your card and upload it here', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Take a picture of the back side of your card and upload it here', { exact: true })
    ).toBeVisible();
    await page.locator("[id='patient-relationship-to-insured']").click();
    await expect(page.getByRole('option').nth(0)).toHaveText('Child');
    await expect(page.getByRole('option').nth(1)).toHaveText('Parent');
    await expect(page.getByRole('option').nth(2)).toHaveText('Mother');
    await expect(page.getByRole('option').nth(3)).toHaveText('Father');
    await expect(page.getByRole('option').nth(4)).toHaveText('Sibling');
    await expect(page.getByRole('option').nth(5)).toHaveText('Spouse');
    await expect(page.getByRole('option').nth(6)).toHaveText('Other');
  });
  test('TC49 Upload Insurance cards', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const fillingInfo = new FillingInfo(page);
    const uploadInsurance = new UploadImage(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByLabel('I have insurance').check();
    await expect(page.getByRole('heading', { name: 'Insurance details' })).toBeVisible();
    await fillingInfo.fillInsuranceRequiredFields();
    const uploadedFrontPhoto = await uploadInsurance.fillInsuranceFront();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadInsurance.fillInsuranceBack();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(uploadedBackPhoto).toBeHidden();
    await uploadInsurance.fillInsuranceFront();
    await uploadInsurance.fillInsuranceBack();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible({ timeout: 15000 });
    await backButton.click();
    const today = await fillingInfo.getToday();
    await expect(page.locator('[id^="insurance-card-front"][id$="-description"]')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    await expect(page.locator('[id^="insurance-card-back"][id$="-description"]')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    // await expect(reuploadedFrontPhoto).toBeVisible();
    // await expect(reuploadedBackPhoto).toBeVisible();
    await backButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await continueButton.click();
    await expect(page.locator('[id^="insurance-card-front"][id$="-description"]')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    await expect(page.locator('[id^="insurance-card-back"][id$="-description"]')).toHaveText(
      `We already have this! It was saved on ${today}. Click to re-upload.`
    );
    // await expect(reuploadedFrontPhoto).toBeVisible();
    // await expect(reuploadedBackPhoto).toBeVisible();
  });

  test('TC51 Check validations on Insurance details', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const currentYear = new Date().getFullYear().toString();
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByLabel('I have insurance').check();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='insurance-carrier']").click();
    await page.locator("[id='insurance-carrier']").fill('Insurance carrier test');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='insurance-member-id']").click();
    await page.locator("[id='insurance-member-id']").fill('Insurance member test');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='policy-holder-first-name']").click();
    await page.locator("[id='policy-holder-first-name']").fill('First name test');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='policy-holder-last-name']").click();
    await page.locator("[id='policy-holder-last-name']").fill('Last name test');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByRole('combobox').nth(0).click({ force: true });
    await page.waitForSelector(`role=option[name="Jun"]`, { state: 'visible' });
    await page.getByRole('option', { name: 'Feb' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('combobox').nth(1).click({ force: true });
    await page.waitForSelector(`role=option[name="10"]`, { state: 'visible' });
    await page.getByRole('option', { name: '10', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('combobox').nth(2).click({ force: true });
    await page.waitForSelector(`role=option[name="2000"]`, { state: 'visible' });
    await page.getByRole('option', { name: '2000' }).click();
    await page.waitForTimeout(500);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.locator("[id='policy-holder-birth-sex']").click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='patient-relationship-to-insured']").click();
    await page.getByRole('option', { name: 'Child' }).click();
    await continueButton.click();
    await page.locator('[id="policy-holder-address"]').click();
    await page.locator('[id="policy-holder-address"]').fill('TestAddress 101');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator('[id="policy-holder-city"]').click();
    await page.locator('[id="policy-holder-city"]').fill('TestCity');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator('[id="policy-holder-state"]').getByText('Select...').click();
    await page.getByRole('option', { name: 'CO' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator('[id="policy-holder-zip"]').click();
    await page.locator('[id="policy-holder-zip"]').fill('10111');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await backButton.click();
    await page.getByRole('combobox').nth(1).click({ force: true });
    await page.waitForSelector(`role=option[name="30"]`, { state: 'visible' });
    await page.getByRole('option', { name: '31', exact: true }).click();
    await continueButton.click();
    await expect(page.getByText('Please enter a valid date')).toBeVisible();
    await page.getByRole('combobox').nth(0).click({ force: true });
    await page.waitForSelector(`role=option[name="Dec"]`, { state: 'visible' });
    await page.getByRole('option', { name: 'Dec', exact: true }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('combobox').nth(2).click({ force: true });
    await page.waitForSelector(`role=option[name="${currentYear}"]`, { state: 'visible' });
    await page.getByRole('option', { name: currentYear, exact: true }).click();
    await continueButton.click();
    await expect(page.getByText('Date may not be in the future')).toBeVisible();
    await page.locator("[id='insurance-carrier']").click();
    await page.locator("[id='insurance-carrier']").fill(' ');
    await expect(page.locator("[id='insurance-carrier-helper-text']")).toHaveText('This field is required');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='insurance-member-id']").click();
    await page.locator("[id='insurance-member-id']").fill(' ');
    await expect(page.locator("[id='insurance-member-id-helper-text']")).toHaveText('This field is required');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='policy-holder-first-name']").click();
    await page.locator("[id='policy-holder-first-name']").fill(' ');
    await expect(page.locator("[id='policy-holder-first-name-helper-text']")).toHaveText('This field is required');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.locator("[id='policy-holder-last-name']").click();
    await page.locator("[id='policy-holder-last-name']").fill(' ');
    await expect(page.locator("[id='policy-holder-last-name-helper-text']")).toHaveText('This field is required');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await fillingInfo.fillInsuranceRequiredFields();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
  });
});
