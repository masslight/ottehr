import { expect, test } from '@playwright/test';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test.describe.serial('TC16 and TC23', () => {
  let bookingURL: string | undefined;
  let month: string;
  let day: string;
  let year: string;
  let firstName: string;
  let lastName: string;
  test.skip('TC23 Duplicate Booking Attempt', async ({ page, context }) => {
    const BookVisit = new BookPrebookVisit(page);
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await fillingInfo.selectSlot();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.click();
    const bookingData = await BookVisit.bookVisit();
    firstName = bookingData.firstName;
    lastName = bookingData.lastName;
    bookingURL = bookingData.bookingURL;
    month = bookingData.randomMonth;
    day = bookingData.randomDay;
    year = bookingData.randomYear;
    const registerAnotherPatient = page.getByRole('button', { name: 'Register another patient' });
    await registerAnotherPatient.click();
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await fillingInfo.selectSlot();
    await page.waitForTimeout(3000);
    await continueButton.click();
    await continueButton.click();
    await page.getByRole('heading', { name: new RegExp(`.*${firstName} ${lastName}.*`, 'i') }).click();
    await continueButton.click();
    await expect(page.getByText('Error')).toBeVisible();
    await expect(
      page.getByText(
        `Oops! It appears ${firstName} is already registered for a check-in time. To view the existing check-in time, click here.`
      )
    ).toBeVisible();
    await page.getByText('Close').click();
    await expect(page.getByText('Error')).toBeHidden();
    await continueButton.click();
    const pagePromise = context.waitForEvent('page');
    await page.getByText('here').click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL(`${bookingURL}`);
  });
  test.skip('TC16 prereq', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    await page.goto(`${bookingURL}`);
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await fillingInfo.cancelPrebookVisit();
  });
  test.skip('TC16 Check DOB', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    await fillingInfo.selectSlot();
    await page.waitForTimeout(3000);
    await continueButton.click();
    await expect(page.getByText('Who is this visit for? is required')).toBeVisible();
    await continueButton.click();
    await page.getByRole('heading', { name: new RegExp(`.*${firstName} ${lastName}.*`, 'i') }).click();
    await continueButton.click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`Confirm ${firstName}'s date of birth`, 'i') })
    ).toBeVisible();
    await backButton.click();
    await expect(page).toHaveURL(/\/patients$/);
    await continueButton.click();
    await expect(page).toHaveURL(/\/confirm-date-of-birth$/);
    await fillingInfo.fillInvalidDOB();
    await continueButton.click();
    await expect(page.getByText('Please enter a valid date')).toBeVisible();
    const newDOB = await fillingInfo.fillWrongDOB(month, day, year);
    const newDay = newDOB.wrongDay;
    const newYear = newDOB.wrongYear;
    const monthDayNumber = await fillingInfo.getMonthDay(newDOB.month, newDay);
    const monthNumber = monthDayNumber.monthNumber;
    const dayNumber = monthDayNumber.dayNumber;
    await continueButton.click();
    console.log(monthNumber + newDay + newYear);
    await expect(page.getByText('Unfortunately, this patient record is not confirmed.')).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(
          `This date of birth \\(${monthNumber}/${dayNumber}/${newYear}\\) doesn’t match the selected patient profile \\(${firstName}\\).`
        )
      )
    ).toBeVisible();
    await expect(page.getByText('You can try again or continue and verify DOB at check-in.')).toBeVisible();
    await page.getByRole('button', { name: 'Continue anyway' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`.*${firstName} ${lastName}.*`, 'i') })).toBeVisible();
    await expect(page.getByText(new RegExp(`.*${newDay}, ${newYear}.*`, 'i'))).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await continueButton.click();
    await expect(page.getByText('Unfortunately, this patient record is not confirmed.')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await fillingInfo.fillCorrectDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByText('About the patient')).toBeVisible();
    await expect(page.getByText(new RegExp(`.*${day}, ${year}.*`, 'i'))).toBeVisible();
    await expect(page.getByPlaceholder('First name')).toBeHidden();
    await expect(page.getByPlaceholder('Last name')).toBeHidden();
    await expect(page.getByText(`Patient's date of birth`)).toBeHidden();
  });
});
