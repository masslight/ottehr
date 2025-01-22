import { expect, test } from '@playwright/test';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test.skip('TC20 Not logged in user can not access pages', async ({ page }) => {
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  const logOutVisible = await page.getByRole('button', { name: 'Logout' }).isVisible();
  if (logOutVisible) {
    await page.getByRole('button', { name: 'Logout' }).click();
  }
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook/patients`);
  await expect(page).toHaveURL(new RegExp('^https://dev-auth.zapehr.com'));
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook/new-user`);
  await expect(page).toHaveURL(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook/patient-information`);
  await expect(page).toHaveURL(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await page.goto('/visits');
  await expect(page).toHaveURL(new RegExp('^https://dev-auth.zapehr.com'));
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook/review`);
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await page.getByRole('button', { name: 'Reserve this check-in time' }).click();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  //   await page.waitForLoadState('networkidle');
  //   await page.waitForTimeout(6000);
  //   await expect(page.getByText('Select check-in time')).toBeVisible();
  //   await expect(page).toHaveURL(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
});

test.describe.serial('Access for not logged user', () => {
  let bookingURL: string | undefined;
  let month: string;
  let day: string;
  let year: string;
  let visitID: string | undefined;
  test.skip('TC21 Not logged in user can access modify and reschedule pages', async ({ page, context }) => {
    await context.clearCookies();
    const BookVisit = new BookPrebookVisit(page);
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.selectRandomSlot();
    //  await BookVisit.login();
    const bookingData = await BookVisit.bookVisit();
    bookingURL = bookingData.bookingURL;
    month = bookingData.randomMonth;
    day = bookingData.randomDay;
    year = bookingData.randomYear;
    const splitIndex = bookingURL.indexOf('visit/');
    visitID = bookingURL.slice(splitIndex + 6);
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.goto(`/visit/${visitID}`);
    await expect(page.getByText('Thank you for choosing Ottehr In Person')).toBeVisible();
    await page.goto(`/visit/${visitID}/reschedule`);
    await expect(page.getByText('Modify check-in time')).toBeVisible();
    await page.goto(`/visit/${visitID}/cancel`);
    await expect(page.getByText('Why are you canceling?')).toBeVisible();
  });

  test.skip('TC22 Not logged in user can access paperwork and check-in', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const tryAgain = page.getByRole('button', { name: 'Try again' });
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.goto(`/paperwork/${visitID}`);
    await expect(page.getByText(`Confirm patient's date of birth`)).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillWrongDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByText('Unfortunately, this patient record is not confirmed.')).toBeVisible();
    await tryAgain.click();
    await expect(page.getByText('Unfortunately, this patient record is not confirmed.')).toBeHidden();
    await fillingInfo.fillCorrectDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByText('Contact information')).toBeVisible();
    await page.goto(`/visit/${visitID}/check-in`);
    await page.waitForTimeout(6000);
    await expect(page.getByText('You are checked in!')).toBeVisible();
  });
});
