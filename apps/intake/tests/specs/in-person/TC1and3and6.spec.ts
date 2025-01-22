import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test.describe.serial('TC1,3,6', () => {
  let bookingURL: string | undefined;
  let FilledfirstName: string | 'TestString';
  let FilledlastName: string | 'TestString';

  test.skip('TC1  Edit appointment type', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible({ timeout: 15000 });
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Different family member' })).toBeVisible();
    await page.getByRole('heading', { name: 'Different family member' }).click();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
    const { firstName, lastName } = await fillingInfo.fillNewPatientInfo();
    FilledfirstName = firstName;
    FilledlastName = lastName;
    console.log('Filled FirstName is:', FilledfirstName);
    await fillingInfo.fillDOBless18();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.getByRole('cell', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Select check-in time' })).toBeVisible();
    const { buttonName } = await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    if (buttonName) {
      const cells = page.getByRole('cell', { name: new RegExp(buttonName, 'i') });
      const cellCount = await cells.count();
      expect(cellCount).toBeGreaterThan(0);
    } else {
      throw new Error('buttonName is not defined');
    }
    await reserveButton.click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 30000 });
    //  await page.waitForLoadState('networkidle');
    bookingURL = page.url();
  });

  test.skip('TC3 Verify that patient from TC1 created', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await page.goto(bookingURL || '/');
    await page.getByRole('button', { name: 'Register another patient' }).click();
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByText('Who is this visit for? is required')).toBeVisible();
  });
  test.skip('TC6 DOB COnfirmation', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await page.goto(bookingURL || '/');
    await fillingInfo.cancelPrebookVisit();
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible({ timeout: 15000 });
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('heading', { name: new RegExp(`.*${FilledfirstName} ${FilledlastName}.*`, 'i') }).click();
    await continueButton.click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`Confirm ${FilledfirstName}'s date of birth`, 'i') })
    ).toBeVisible();
  });
});
