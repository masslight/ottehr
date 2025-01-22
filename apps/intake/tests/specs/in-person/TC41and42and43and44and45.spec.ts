import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
test.describe.configure({ mode: 'parallel' });

test.describe.skip('TC41-45', () => {
  let FilledfirstName: string;
  let FilledlastName: string;
  let PaperworkURL: string;
  let FilledBirthDay: string;
  let FilledBirthMonth: string;
  let FilledBirthYear: string;
  let FilledMiddleName: string;
  let BirthSex: string;
  let FilledEmail: string;

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
    FilledBirthDay = bookingData.randomDay;
    FilledBirthMonth = bookingData.randomMonth;
    FilledBirthYear = bookingData.randomYear;
    FilledEmail = bookingData.email;
    BirthSex = bookingData.BirthSex;
    await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    PaperworkURL = page.url();
    console.log('Paperwork URL:', PaperworkURL);
  });
  test('TC43 Check content and validations on payment option', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByText('This field is required')).toBeVisible();
    await expect(page.getByText(`${FilledfirstName} ${FilledMiddleName} ${FilledlastName}`)).toBeVisible();
    await expect(page.getByText('Select payment option *', { exact: true })).toBeVisible();
    await expect(page.getByText('I have insurance', { exact: true })).toBeVisible();
    await expect(page.getByText('I will pay without insurance', { exact: true })).toBeVisible();
    await backButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await page.getByLabel('I have insurance').check();
    await expect(page.getByRole('heading', { name: 'Insurance details' })).toBeVisible();
  });
  test('TC42 Check content and validations on responsible party', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await continueButton.click();
    await page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await backButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await expect(page.getByLabel('I will pay without insurance')).toBeChecked();
    await continueButton.click();
    await expect(page.getByText(`${FilledfirstName} ${FilledMiddleName} ${FilledlastName}`)).toBeVisible();
    await expect(
      page.getByText(
        "A responsible party is the individual responsible for the visit's financial obligations. If the patient is not their own responsible party (most common), then the responsible party must be the patient's legal guardian or legal designee."
      )
    ).toBeVisible();
    await expect(page.getByText('Relationship *', { exact: true })).toBeVisible();
    await expect(page.getByText('First name *', { exact: true })).toBeVisible();
    await expect(page.getByText('Last name *', { exact: true })).toBeVisible();
    await expect(page.getByText('Date of birth *', { exact: true })).toBeVisible();
    await expect(page.getByText('Birth sex *', { exact: true })).toBeVisible();
    await expect(page.getByText('Phone (optional)', { exact: true })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await page.locator("[id='responsible-party-relationship']").click();
    await page.getByRole('option', { name: 'Father' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await page.locator("[id='responsible-party-first-name']").fill('TestName');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await page.locator("[id='responsible-party-last-name']").fill('TestName');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await page.locator("[id='responsible-party-birth-sex']").click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await page.locator("[id='responsible-party-number']").fill('12345689');
    await expect(
      page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx', { exact: true })
    ).toBeVisible();
    await page.getByRole('combobox').nth(1).click({ force: true });
    await page.waitForSelector(`role=option[name="Feb"]`, { state: 'visible' });
    await page.getByRole('option', { name: 'Feb' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('combobox').nth(2).click({ force: true });
    await page.waitForSelector(`role=option[name="30"]`, { state: 'visible' });
    await page.getByRole('option', { name: '30', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('combobox').nth(3).click({ force: true });
    await page.waitForSelector(`role=option[name="2022"]`, { state: 'visible' });
    await page.getByRole('option', { name: '2022' }).click();
    await continueButton.click();
    await expect(
      page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('Please enter a valid date', { exact: true })).toBeVisible();
    await fillingInfo.ResponsiblePartyLegalGuardian();
    await page.locator("[id='responsible-party-number']").click();
    await page.locator("[id='responsible-party-number']").fill('');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
  });
  test('TC41 Select Self option', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
    await fillingInfo.NewPatientDetails();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
    await continueButton.click();
    await page.getByLabel('I will pay without insurance').check();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
    await page.locator("[id='responsible-party-relationship']").click();
    await expect(page.getByRole('option').nth(0)).toHaveText('Self');
    await expect(page.getByRole('option').nth(1)).toHaveText('Legal Guardian');
    await expect(page.getByRole('option').nth(2)).toHaveText('Father');
    await expect(page.getByRole('option').nth(3)).toHaveText('Mother');
    await expect(page.getByRole('option').nth(4)).toHaveText('Spouse');
    await page.getByRole('option', { name: 'Self' }).click();
    await expect(page.locator("[id='responsible-party-first-name']")).toHaveValue(FilledfirstName);
    await expect(page.locator("[id='responsible-party-first-name']").getAttribute('disabled')).not.toBeNull();
    await expect(page.locator("[id='responsible-party-last-name']")).toHaveValue(FilledlastName);
    await expect(page.locator("[id='responsible-party-last-name']").getAttribute('disabled')).not.toBeNull();
    await expect(page.locator("[id='responsible-party-birth-sex'] p")).toHaveText(BirthSex);
    const birthSexhasDisabledClass = await page
      .locator("[id='responsible-party-birth-sex']")
      .evaluate((element) => element.classList.contains('Mui-disabled'));
    expect(birthSexhasDisabledClass).toBe(true);
    const birthDayhasDisabledClass = await page
      .getByRole('combobox')
      .nth(2)
      .evaluate((element) => element.classList.contains('Mui-disabled'));
    expect(birthDayhasDisabledClass).toBe(true);
    const birthMonthhasDisabledClass = await page
      .getByRole('combobox')
      .nth(1)
      .evaluate((element) => element.classList.contains('Mui-disabled'));
    expect(birthMonthhasDisabledClass).toBe(true);
    const birthYearhhasDisabledClass = await page
      .getByRole('combobox')
      .nth(3)
      .evaluate((element) => element.classList.contains('Mui-disabled'));
    expect(birthYearhhasDisabledClass).toBe(true);
    await expect(page.getByRole('combobox').nth(2)).toHaveText(FilledBirthDay);
    await expect(page.getByRole('combobox').nth(3)).toHaveText(FilledBirthYear);
    await expect(page.getByRole('combobox').nth(1)).toHaveText(FilledBirthMonth);
    //await expect(page.locator("[id*='responsible-party-number.']")).toHaveValue('(844) 607-4725');
    await page.locator("[id='responsible-party-number']").fill('1111111111');
    await expect(page.locator("[id='responsible-party-number']")).toHaveValue('(111) 111-1111');
    await page.locator("[id='responsible-party-relationship']").click();
    await page.getByRole('option', { name: 'Legal Guardian' }).click();
    await expect(page.locator("[id='responsible-party-first-name']")).toHaveValue('');
    await expect(page.locator("[id='responsible-party-last-name']")).toHaveValue('');
    await expect(page.locator("[id='responsible-party-birth-sex'] p")).toHaveText('Select...');
    // regression issue, it's decided not to fix for now
    // await expect(page.getByRole('combobox').nth(2)).toHaveText('');
    // await expect(page.getByRole('combobox').nth(3)).toHaveText('');
    // await expect(page.getByRole('combobox').nth(1)).toHaveText('');
    await expect(page.locator("[id='responsible-party-number']")).toHaveValue('(111) 111-1111');
    await fillingInfo.ResponsiblePartyLegalGuardian();
  });
  test('TC44 Check content and validations on Contact information when patient over 18', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`${FilledfirstName} ${FilledMiddleName} ${FilledlastName}`)).toBeVisible();
    await expect(
      page.getByText(
        'Completing the following forms will save time in our office and ensure a smooth check-in experience. Thanks for your cooperation!'
      )
    ).toBeVisible();
    await expect(page.getByText(`${FilledfirstName}'s primary addres`)).toBeVisible();
    await expect(page.getByText('Street address *', { exact: true })).toBeVisible();
    await expect(page.getByText('Address line 2 (optional)', { exact: true })).toBeVisible();
    await expect(page.getByText('City *', { exact: true })).toBeVisible();
    await expect(page.getByText('State *', { exact: true })).toBeVisible();
    await expect(page.getByText('ZIP *', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Additional information' })).toBeVisible();
    await expect(
      page.getByText('Please provide the information for the best point of contact regarding this reservation.')
    ).toBeVisible();
    await expect(page.getByText('I am filling out this info as: *', { exact: true })).toBeVisible();
    await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
    await expect(page.getByText('Parent/Guardian email *', { exact: true })).toBeVisible();
    await expect(page.getByText('Parent/Guardian mobile *', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient (Self)', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient email')).toBeVisible();
    await expect(page.getByText('Patient mobile')).toBeVisible();
    // NEED TO UNCOMMENT WHEN IT'S FIXED
    // await expect(
    //   page.getByText(
    //     'Yes! I would like to receive helpful messages from Ottehr regarding patient education, events, and general information about our offices. Message frequency varies, and data rates may apply.'
    //   )
    // ).toBeVisible();
    // await expect(page.locator("[id*='guardian-email.']")).toHaveValue(FilledEmail);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await page.locator("[id='patient-street-address']").fill('Test Address');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await page.locator("[id='patient-city']").fill('Test City');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await page.locator("[id='patient-state']").click();
    await page.getByRole('option', { name: 'AK' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await page.locator("[id='patient-zip']").fill('123');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await page.locator("[id='guardian-number']").click();
    await page.locator("[id='guardian-number']").fill('123');
    await page.locator("[id='guardian-email']").click();
    await page.locator("[id='guardian-email']").fill('invalidemail');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
    await expect(page.locator('#guardian-number-helper-text')).toHaveText(
      'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
    );
    await expect(page.locator('#patient-zip-helper-text')).toHaveText('ZIP Code must be 5 numbers');
    await expect(page.locator('#guardian-email-helper-text')).toHaveText('Email is not valid');
    await page.locator("[id='guardian-number']").click();
    await page.locator("[id='guardian-number']").fill('1234567890');
    await expect(
      page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx', { exact: true })
    ).toBeHidden();
    await page.locator("[id='guardian-email']").click();
    await page.locator("[id='guardian-email']").fill(FilledEmail);
    await expect(page.getByText('Email is not valid', { exact: true })).toBeHidden();
    await page.locator("[id='patient-zip']").click();
    await page.locator("[id='patient-zip']").fill('12345');
    await expect(page.getByText('ZIP Code must be 5 numbers', { exact: true })).toBeHidden();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible({ timeout: 15000 });
    await backButton.click();
    await page.locator("[id='patient-city']").click();
    await page.locator("[id='patient-city']").fill('');
    await page.locator("[id='patient-street-address']").click();
    await page.locator("[id='patient-street-address']").fill('');
    await page.locator("[id='patient-zip']").click();
    await page.locator("[id='patient-zip']").fill('');
    await page.locator("[id='guardian-number']").click();
    await page.locator("[id='guardian-number']").fill('');
    await page.locator("[id='guardian-email']").click();
    await page.locator("[id='guardian-email']").fill('');
    await page.locator("[id='guardian-number']").click();
    await expect(page.locator("[id='patient-street-address-helper-text']")).toHaveText('This field is required');
    await expect(page.locator("[id='patient-city-helper-text']")).toHaveText('This field is required');
    await expect(page.locator("[id='patient-zip-helper-text']")).toHaveText('This field is required');
    await expect(page.locator("[id='guardian-email-helper-text']")).toHaveText('This field is required');
    await expect(page.locator("[id='guardian-number-helper-text']")).toHaveText('This field is required');
  });
  test('TC45 Check patient and parent fields if patient over 18', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    const fillingInfo = new FillingInfo(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="radio"][value="Parent/Guardian"]')).toBeChecked();
    await expect(page.getByText('Parent/Guardian email *', { exact: true })).toBeVisible();
    await expect(page.getByText('Parent/Guardian mobile *', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient email', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient mobile', { exact: true })).toBeVisible();
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible({ timeout: 15000 });
    await backButton.click();
    await page.locator("[id='guardian-number']").click();
    await page.locator("[id='guardian-number']").fill('');
    await page.locator("[id='guardian-email']").click();
    await page.locator("[id='guardian-email']").fill('');
    await continueButton.click();
    await expect(page.locator("[id='guardian-email-helper-text']")).toHaveText('This field is required');
    await expect(page.locator("[id='guardian-email-helper-text']")).toHaveText('This field is required');
    await page.getByLabel('Patient (Self)', { exact: true }).check();
    await expect(page.getByText('Parent/Guardian email', { exact: true })).toBeVisible();
    await expect(page.getByText('Parent/Guardian mobile', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient email *', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient mobile *', { exact: true })).toBeVisible();
    await page.locator("[id='guardian-number']").fill('1234567890');
    await page.locator("[id='guardian-email']").fill(FilledEmail);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await page.locator("[id='patient-number']").fill('1234');
    await page.locator("[id='patient-email']").fill('FilledEmail');
    await expect(page.getByText('Email is not valid', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx', { exact: true })
    ).toBeVisible();
    await page.locator("[id='patient-number']").click();
    await page.locator("[id='patient-email']").click();
    await page.locator("[id='patient-number']").fill('1234567890');
    await page.locator("[id='patient-email']").fill(FilledEmail);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible({ timeout: 15000 });
    await backButton.click();
    await page.locator("[id='patient-number']").click();
    await page.locator("[id='patient-number']").fill('');
    await page.locator("[id='patient-email']").click();
    await page.locator("[id='patient-email']").fill('');
    await continueButton.click();
    await expect(page.locator("[id='patient-email-helper-text']")).toHaveText('This field is required');
    await expect(page.locator("[id='patient-number-helper-text']")).toHaveText('This field is required');
  });
});
