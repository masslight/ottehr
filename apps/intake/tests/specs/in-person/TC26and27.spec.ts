import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';

test.describe.serial('TC27', () => {
  let bookingURL: string | undefined;
  let month: string;
  let day: string;
  let year: string;

  test.skip('TC26 and TC27 prereq', async ({ page }) => {
    const BookVisit = new BookPrebookVisit(page);
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await fillingInfo.selectSlot();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    const bookingData = await BookVisit.bookNewPatientGT18yoAsParentFromPatientsScreen();
    bookingURL = bookingData.bookingURL;
    month = bookingData.randomMonth;
    day = bookingData.randomDay;
    year = bookingData.randomYear;
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await fillingInfo.cancelPrebookVisit();
  });

  test.skip('TC27 ', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('button', { name: 'Proceed to paperwork' })).toBeVisible();
    await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient (Self)', { exact: true })).toBeVisible();
    await expect(page.locator('input[type="radio"][value="Parent/Guardian"]')).toBeChecked();
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.goto(`${bookingURL}`);
    await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
    await expect(page.getByText(`Confirm patient's date of birth`)).toBeVisible();
    await fillingInfo.fillCorrectDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByText('Contact information')).toBeVisible();
    await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient (Self)', { exact: true })).toBeVisible();
    await expect(page.locator('input[type="radio"][value="Parent/Guardian"]')).toBeChecked();
  });

  // Test case is written correctly, but it's failed due to known issue. Need to uncomment, when issue is fixed.

  // test('TC26 Patient >18y enters date <18 on Confirm DOB', async ({ page }) => {
  //   const fillingInfo = new FillingInfo(page);
  //   const continueButton = page.getByRole('button', { name: 'Continue' });
  //   await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  //   await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  //   await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  //   await fillingInfo.selectSlot();
  //   await page.waitForTimeout(3000);
  //   await continueButton.click();
  //   await continueButton.click();
  //   await page.getByRole('heading', { name: new RegExp(`.*${firstName} ${lastName}.*`, 'i') }).click();
  //   await continueButton.click();
  //   await fillingInfo.fillDOBless18();
  //   await continueButton.click();
  //   await page.getByRole('button', { name: 'Continue anyway' }).click();
  //   await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
  //   await expect(page.locator('input[name="emailUser"][value="Parent/Guardian"]')).toBeChecked();
  //   await expect(page.getByText('Patient', { exact: true })).toBeHidden();
  // });
});
