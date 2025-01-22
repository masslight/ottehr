import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
test.describe.configure({ mode: 'parallel' });
test.describe.skip('TC17 and TC18', () => {
  let FilledfirstName: string;
  let FilledlastName: string;
  let FilledmiddleName: string;
  let month: string;
  let day: string;
  let formattedDay: string;
  let year: string;
  let sex: string;
  let filledEmail: string;

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
    FilledmiddleName = bookingData.middleName;
    month = bookingData.randomMonth;
    day = bookingData.randomDay;
    formattedDay = day.toString().padStart(2, '0');
    year = bookingData.randomYear;
    sex = bookingData.BirthSex;
    filledEmail = bookingData.email;
    console.log('Filled name is:', FilledfirstName, FilledlastName);
    await fillingInfo.cancelPrebookVisit();
  });

  test('TC17 Continue with existing patient pop-up', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    //const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    const fillingInfo = new FillingInfo(page);
    const monthMap: { [key: string]: string } = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    };
    const numericMonth = monthMap[month];
    const continueWithExistingPatientText = `Continue with existing patient account for ${FilledfirstName}`;
    const accountInformationText = `account with that information: ${FilledfirstName} ${FilledlastName}, ${numericMonth}/${formattedDay}/${year}`;
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible({ timeout: 15000 });
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Different family member' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('heading', { name: 'Different family member' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
    await page.getByPlaceholder('First name').click();
    await page.getByPlaceholder('First name').fill(FilledfirstName);
    await page.getByPlaceholder('Last name').click();
    await page.getByPlaceholder('Last name').fill(FilledlastName);
    await fillingInfo.fillCorrectDOB(month, day, year);
    await page.locator('#sex').click();
    await page.getByRole('option', { name: sex, exact: true }).click();
    await page.getByPlaceholder('example@mail.com').click();
    await page.getByPlaceholder('example@mail.com').fill(filledEmail);
    await fillingInfo.fillVisitReason();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Continue with existing' })).toBeVisible();
    await expect(page.locator(`text=${continueWithExistingPatientText}`)).toBeVisible();
    await expect(page.locator(`text=${accountInformationText}`)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Continue with existing' })).toBeVisible();
    await page.getByRole('button', { name: 'Use existing account' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  });
  test('TC18 Patient info validation', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible({ timeout: 15000 });
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    if (FilledfirstName) {
      const headings = page.getByRole('heading');
      const matchingHeadings = headings.filter({ hasText: new RegExp(FilledfirstName, 'i') });
      const headingCount = await matchingHeadings.count();
      expect(headingCount).toBeGreaterThan(0);
      await page.getByRole('heading', { name: new RegExp(`.*${FilledfirstName}.*`, 'i') }).click();
      await continueButton.click();
      await expect(
        page.getByRole('heading', { name: new RegExp(`Confirm ${FilledfirstName}'s date of birth`, 'i') })
      ).toBeVisible();
    } else {
      throw new Error('FilledfirstName is not set');
    }
    await fillingInfo.fillCorrectDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
    await expect(page.locator(`text=${FilledfirstName} ${FilledmiddleName} ${FilledlastName}`)).toBeVisible();
    const birthdayRegex = new RegExp(`Birthday: ${month}.*${day}, ${year}`);
    await expect(page.locator('text=Birthday:')).toContainText(birthdayRegex);
    await expect(page.locator('#sex')).toContainText(`${sex}`);
    // await expect(
    // page.locator('text="Wrong patient? Please go back for a new patient or different existing patient record."')
    //).toBeVisible();
    await expect(
      page.locator(
        'p.MuiTypography-root:has-text("Wrong patient? Please go back for a new patient or different existing patient record.")'
      )
    ).toBeVisible();
    await expect(page.locator('input#email')).toHaveValue(filledEmail);
    await expect(page.locator('#reasonForVisit')).toHaveText('Select...');
    await page.locator('input#email').fill(`Updated${filledEmail}`);
    await page.getByRole('link', { name: 'go back' }).click();
    await expect(page).toHaveURL(/\/patients$/);
  });
});
