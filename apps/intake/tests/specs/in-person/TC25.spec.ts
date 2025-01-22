import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
import { UIDesign } from '../../utils/in-person/UIdesign';
import { Validations } from '../../utils/in-person/Validations';

test.describe.serial('TC25', () => {
  let FilledfirstName: string;
  let FilledlastName: string;
  let FilledmiddleName: string;
  let PaperworkURL: string;

  test.skip('prerequisites', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    PaperworkURL = page.url();
  });

  test.skip('TC25 NewPatient details checks', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const backButton = page.getByRole('button', { name: 'Back' });
    //const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    const fillingInfo = new FillingInfo(page);
    const UIdesign = new UIDesign(page);
    const Validation = new Validations(page);
    await page.goto(PaperworkURL || '/');
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.fillContactInformation();
    await continueButton.click();
    await UIdesign.PatientDetailsUIcheck(FilledfirstName, FilledmiddleName, FilledlastName);
    await expect(page.getByText('sex')).not.toBeVisible();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-details$/);
    await Validation.validateEthnicity();
    await page.getByRole('option', { name: 'Decline To Specify' }).click();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-details$/);
    await Validation.validateRace();
    await page.getByRole('option', { name: 'Decline To Specify' }).click();
    await Validation.validatePronouns();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-details$/);
    await Validation.validateHowDidYouHear();
    await continueButton.click();
    await expect(page).toHaveURL(/\/patient-details$/);
    await Validation.validateVirtualOption();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible({
      timeout: 15000,
    });
    await backButton.click();
    await page.locator("[id='pharmacy-phone']").click();
    await page.locator("[id='pharmacy-phone']").fill('(123');
    await continueButton.click();
    await expect(page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx')).toBeVisible();
    await backButton.click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
  });
});
