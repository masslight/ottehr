import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
test.describe.configure({ mode: 'parallel' });
test.describe.skip('TC19', () => {
  test('Check slots sorting', async ({ page }) => {
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    // Locate all time slot buttons within the specified element
    const timeSlots = await page.locator('div#appointment-picker-tabpanel-0 .time-button').allTextContents();
    // Function to convert time string to a comparable value
    function convertToComparableTime(timeString: string): number {
      const [time, period] = timeString.split(' ');
      // eslint-disable-next-line prefer-const
      let [hours, minutes] = time.split(':').map(Number);

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return hours * 60 + minutes; // Convert to minutes since midnight
    }
    // Convert the time slot strings to comparable values
    const comparableTimes = timeSlots.map(convertToComparableTime);
    // Check that the times are sorted in ascending order
    for (let i = 0; i < comparableTimes.length - 1; i++) {
      expect(comparableTimes[i]).toBeLessThanOrEqual(comparableTimes[i + 1]);
    }
  });
  test('TC19 Validations', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    //const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    const fillingInfo = new FillingInfo(page);
    const firstName = `TA-UserFN${fillingInfo.getRandomString()}`;
    const lastName = `TA-UserLN${fillingInfo.getRandomString()}`;
    const email = `ykulik+${firstName}@masslight.com`;
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
    await expect(page.locator('text=Birthday:')).toHaveCount(0);
    //Verify that fields are not prefilled
    await expect(page.locator('input#firstName')).toHaveValue('');
    await expect(page.locator('input#middleName')).toHaveValue('');
    await expect(page.locator('input#lastName')).toHaveValue('');
    await expect(page.locator('input#email')).toHaveValue('');
    await expect(page.locator('#reasonForVisit')).toHaveText('Select...');
    await expect(page.locator('#sex >> text="Select..."')).toBeVisible();
    // Verify the date of birth inputs (month, day, year) are not filled
    await expect(page.getByRole('combobox').nth(0)).toHaveText('');
    await expect(page.getByRole('combobox').nth(1)).toHaveText('');
    await expect(page.getByRole('combobox').nth(2)).toHaveText('');
    await continueButton.click();
    //Can't proceed without required values
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByPlaceholder('First name').click();
    await page.getByPlaceholder('First name').fill(firstName);
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByPlaceholder('Last name').click();
    await page.getByPlaceholder('Last name').fill(lastName);
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByRole('combobox').nth(0).click({ force: true });
    await page.getByRole('option', { name: 'May' }).click();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByRole('combobox').nth(1).click({ force: true });
    await page.getByRole('option', { name: '22' }).click();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByRole('combobox').nth(2).click({ force: true });
    await page.getByRole('option', { name: '2020' }).click();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.locator('#sex').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByPlaceholder('example@mail.com').click();
    await page.getByPlaceholder('example@mail.com').fill(email);
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await fillingInfo.fillVisitReason();
    await page
      .getByRole('textbox', { name: 'Tell us more (optional)' })
      .fill(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam sodales, nisl tincidunt porttitor auctor, ex lectus imperdiet ligula, vitae tincidunt nibh sapien.'
      );
    await continueButton.click();
    await expect(page.getByText('Please limit your response to 155 characters')).toBeVisible();
    // all fields are filled
    const Reason = await fillingInfo.fillVisitReason();
    const FilledReason = Reason.enteredReason;
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    //verify that fields are not empty
    await expect(page.locator('input#firstName')).not.toHaveValue('');
    await expect(page.locator('input#lastName')).not.toHaveValue('');
    await expect(page.locator('input#email')).not.toHaveValue('');
    await expect(page.getByText(`${FilledReason}`)).toBeVisible();
    await expect(page.locator('#sex >> text="Select..."')).not.toBeVisible();
    await expect(page.getByRole('combobox').nth(0)).not.toHaveText('');
    await expect(page.getByRole('combobox').nth(1)).not.toHaveText('');
    await expect(page.getByRole('combobox').nth(2)).not.toHaveText('');
    //whitespaces check
    await page.getByPlaceholder('First name').click();
    await page.getByPlaceholder('First name').fill('  ');
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByPlaceholder('First name').fill(firstName);
    await page.getByPlaceholder('Last name').click();
    await page.getByPlaceholder('Last name').fill('  ');
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByPlaceholder('Last name').fill(lastName);
    await page.getByPlaceholder('example@mail.com').click();
    await page.getByPlaceholder('example@mail.com').fill('  ');
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-information$/);
    await page.getByPlaceholder('example@mail.com').fill(email);
    // await page.getByRole('textbox', { name: 'Tell us more (optional)' }).fill('  '); - not used anymore
    await continueButton.click();
    //await expect(page.getByText('Reason for visit is required')).toBeVisible();
  });
});
