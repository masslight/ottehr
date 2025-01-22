import { expect, test } from '@playwright/test';
import { BookPrebookVisit } from '../../utils/in-person/BookPrebookVisit';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { Paperwork } from '../../utils/in-person/Paperwork';

test.describe.serial('TC7,8,12', () => {
  let bookingURL: string | undefined;
  let FilledfirstName: string | undefined;
  let FilledlastName: string | undefined;
  let FilledmiddleName: string | undefined;
  let month: string;
  let day: string;
  let year: string;
  let randomEthnicity: string;
  let randomRace: string;
  let randomPronouns: string;
  let randomOVRP: string;

  test.skip('TC8  Prebook with Parent/Guardian option ', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const BookVisit = new BookPrebookVisit(page);
    const FillPaperwork = new Paperwork(page);
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
    year = bookingData.randomYear;
    await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await FillPaperwork.FillPaperworkNewPatientAsParentWOid();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 25000 });
    //  await page.waitForLoadState('networkidle');
    bookingURL = page.url();
    console.log('Booking URL:', bookingURL);
    await expect(page.getByRole('heading', { name: 'Your check-in time is booked' })).toBeVisible({ timeout: 25000 });
  });

  test.skip('TC12 Consent form is not prefilled', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    const fillingInfo = new FillingInfo(page);
    const FillPaperwork = new Paperwork(page);
    await page.goto(bookingURL || '/');
    await fillingInfo.cancelPrebookVisit();
    await page.waitForURL(/\/cancellation-confirmation/);
    await expect(page.getByText('Your visit has been canceled')).toBeVisible();
    await page.getByRole('button', { name: 'Book again' }).click();
    await page.waitForURL(/\/prebook/);
    await expect(page.getByText('Select check-in time')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await expect(page.getByText('Who is this visit for? *')).toBeVisible({ timeout: 15000 });
    await page
      .getByRole('heading', { name: new RegExp(`.*${FilledfirstName} ${FilledmiddleName} ${FilledlastName}.*`, 'i') })
      .click();
    await continueButton.click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`Confirm ${FilledfirstName}'s date of birth`, 'i') })
    ).toBeVisible();
    await fillingInfo.fillCorrectDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
    await fillingInfo.fillVisitReason();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await reserveButton.click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
    const FilledPaperwork = await FillPaperwork.FillPaperworkExistingPatientAsParentWOid();
    randomEthnicity = FilledPaperwork.randomEthnicity;
    randomRace = FilledPaperwork.randomRace;
    randomPronouns = FilledPaperwork.randomPronouns;
    randomOVRP = FilledPaperwork.randomOVRP;
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 25000 });
    await expect(page.getByRole('heading', { name: 'Your check-in time is booked' })).toBeVisible({ timeout: 25000 });
    bookingURL = page.url();
    console.log('Booking URL:', bookingURL);
    await fillingInfo.cancelPrebookVisit();
  });

  test.skip('TC7 How did you hear option absent for patient from TC8 and filled info correct', async ({ page }) => {
    const fillingInfo = new FillingInfo(page);
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible({ timeout: 15000 });
    await fillingInfo.selectRandomSlot();
    await expect(page.getByRole('heading', { name: 'Get ready for your visit' })).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await expect(page.getByText('Who is this visit for? *')).toBeVisible();
    await page
      .getByRole('heading', { name: new RegExp(`.*${FilledfirstName} ${FilledmiddleName} ${FilledlastName}.*`, 'i') })
      .click();
    await continueButton.click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`Confirm ${FilledfirstName}'s date of birth`, 'i') })
    ).toBeVisible();
    await fillingInfo.fillCorrectDOB(month, day, year);
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
    await fillingInfo.fillVisitReason();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
    await reserveButton.click();
    await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
    await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="radio"][value="Parent/Guardian"]')).toBeChecked();
    await expect(page.locator('[id="guardian-email"]')).toHaveValue('ykulik+ta@masslight.com');
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'Additional information' })).toBeVisible();
    await expect(page.getByText('How did you hear about us? *')).not.toBeVisible();
    const OVRPdropdownValue = await page.locator('[id="ovrp-interest"]').innerText();
    expect(OVRPdropdownValue).toBe(randomOVRP);
    const EthnicitydropdownValue = await page.locator('[id="patient-ethnicity"]').innerText();
    expect(EthnicitydropdownValue).toBe(randomEthnicity);
    const RaceropdownValue = await page.locator('[id="patient-race"]').innerText();
    expect(RaceropdownValue).toBe(randomRace);
    const pronounsdropdownValue = await page.locator('[id="patient-pronouns"]').innerText();
    expect(pronounsdropdownValue).toBe(randomPronouns);
    await fillingInfo.PatientDetailsWithFilledPaperwor();
    await continueButton.click();
    await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible({
      timeout: 15000,
    });
  });
});
