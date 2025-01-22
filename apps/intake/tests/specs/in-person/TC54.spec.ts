import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { UploadImage } from '../../utils/in-person/UploadImage';

test.describe.configure({ mode: 'parallel' });

test.skip('TC54 Walkin without paperwork', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
  //await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible({ timeout: 15000 });
  await fillingInfo.WalkinInformationAsParentProceed();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Different family member' })).toBeVisible();
  await page.getByRole('heading', { name: 'Different family member' }).click();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
  const patientName = await fillingInfo.fillNewPatientInfo();
  const firstName = patientName.firstName;
  const lastName = patientName.lastName;
  const middleName = await fillingInfo.fillMiddleName();
  await fillingInfo.fillDOBless18();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await expect(page.getByText('Review and confirm all details below.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visit details' })).toBeVisible();
  await expect(page.getByText('Patient')).toBeVisible();
  await expect(page.getByText('Office')).toBeVisible();
  await expect(page.getByText('Walk-in time', { exact: true })).toBeVisible();
  await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).toBeVisible();
  await expect(page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this walk-in time' })).toBeVisible();
  const nowInEDT = DateTime.now().setZone('America/New_York');
  const format = 'LLLL d, h:mm a ZZZZ';
  const formattedDateTime = nowInEDT.toFormat(format);
  await page.getByRole('button', { name: 'Confirm this walk-in time' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible({ timeout: 25000 });
  const VisitURL = page.url();
  await page.goto(`/visits`);
  await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).toBeVisible();
  // Locate the booking for the specific patient
  const booking = page.locator('.MuiGrid-container.appointment').filter({
    has: page.getByText(`${firstName} ${middleName} ${lastName}`),
  });
  // Check that the "Modify" button is absent (if it exists in other cases)
  const modifyButton = booking.locator('button:has-text("Modify")');
  await expect(modifyButton).not.toBeVisible();
  // Check that the "Check In" button is absent
  const checkInButton = booking.locator('button:has-text("Check In")');
  await expect(checkInButton).not.toBeVisible();
  // Check that the text "You are checked in" is present
  const checkInText = booking.locator('.check-in h6:has-text("You are checked in")');
  await expect(checkInText).toBeVisible();
  // Check that the time is equal to the expected formatted date and time
  const timeLocator = booking.locator('.date');
  await expect(timeLocator).toHaveText(formattedDateTime);
  // Check that the location is equal to the expected location
  const locationLocator = booking.locator('.location');
  const actualLocation = await locationLocator.innerText();
  const locationFromEnv = `${process.env.SLUG_ONE}`;
  expect(actualLocation.trim().toLowerCase()).toBe(locationFromEnv.toLowerCase());
  // Check that the text "Paperwork incomplete" is present
  const paperworkText = booking.locator('.paperwork h6:has-text("Paperwork incomplete")');
  await expect(paperworkText).toBeVisible();
  // Check that the "Cancel" button is hidden
  const cancelButton = booking.locator('button:has-text("Cancel")');
  await expect(cancelButton).toBeHidden();
  await page.goto(VisitURL || '/');
  await expect(page.getByRole('button', { name: 'Register another patient' })).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: 'Register another patient' }).click();
  await expect(page).toHaveURL(/walkin/);
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible();
  await fillingInfo.WalkinInformationAsParentProceed();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
});

test.skip('TC54 Prebook with completed paperwork', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const uploadPhoto = new UploadImage(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
  const newPatient = page.getByText('Different family member');
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await fillingInfo.selectRandomSlot();
  await page.waitForTimeout(3000);
  await continueButton.click();
  await continueButton.click();
  await newPatient.click();
  await continueButton.click();
  const patientName = await fillingInfo.fillNewPatientInfo();
  const firstName = patientName.firstName;
  const lastName = patientName.lastName;
  const middleName = await fillingInfo.fillMiddleName();
  await fillingInfo.fillDOBgreater18();
  await continueButton.click();
  await reserveButton.click();
  await page.waitForURL(/\/visit/);
  await page.waitForTimeout(6000);

  await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
  await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
  await fillingInfo.fillContactInformation();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
  await fillingInfo.NewPatientDetails();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'How would you like to pay for your visit?' })).toBeVisible();
  await page.getByLabel('I will pay without insurance').check();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
  await fillingInfo.ResponsiblePartyRandom();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
  await uploadPhoto.fillPhotoFrontID();
  await uploadPhoto.fillPhotoBackID();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
  await fillingInfo.fillConsentForm();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('button', { name: 'Edit paperwork' })).toBeVisible();

  await page.goto(`/visits`);
  await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).toBeVisible();
  // Locate the booking for the specific patient
  const booking = page.locator('.MuiGrid-container.appointment').filter({
    has: page.getByText(`${firstName} ${middleName} ${lastName}`),
  });
  // Check that the "Modify" button is present
  const modifyButton = booking.locator('button:has-text("Modify")');
  await expect(modifyButton).toBeVisible();
  // Check that the "Check In" button is present
  const checkInButton = booking.locator('button:has-text("Check In")');
  await expect(checkInButton).toBeVisible();
  // Check that the text "You are checked in" is present
  const checkInText = booking.locator('.check-in h6:has-text("Check in when you arrive")');
  await expect(checkInText).toBeVisible();
  // Check that the location is equal to the expected location
  const locationLocator = booking.locator('.location');
  const actualLocation = await locationLocator.innerText();
  const locationFromEnv = `${process.env.SLUG_ONE}`;
  expect(actualLocation.trim().toLowerCase()).toBe(locationFromEnv.toLowerCase());
  // Check that the text "Paperwork complete" is present
  const paperworkText = booking.locator('.paperwork h6:has-text("Your paperwork is complete")');
  await expect(paperworkText).toBeVisible();
  // Check that the "Cancel" button is hidden
  const cancelButton = booking.locator('button:has-text("Cancel")');
  await expect(cancelButton).toBeVisible();
  // Check that the "Edit" paperwork button is hidden
  const editButton = booking.locator('button:has-text("Edit")');
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(page.getByRole('button', { name: 'Edit paperwork' })).toBeVisible();
  await page.goto(`/visits`);
  await modifyButton.click();
  await expect(page.getByText('Please select a new check-in')).toBeVisible();
  await page.goto(`/visits`);
  await checkInButton.click();
  await expect(page.getByRole('heading', { name: 'You are checked in!' })).toBeVisible();
});

test.skip('TC54 Prebook without paperwork', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
  const newPatient = page.getByText('Different family member');
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await fillingInfo.selectRandomSlot();
  await page.waitForTimeout(3000);
  await continueButton.click();
  await newPatient.click();
  await continueButton.click();
  const patientName = await fillingInfo.fillNewPatientInfo();
  const firstName = patientName.firstName;
  const lastName = patientName.lastName;
  const middleName = await fillingInfo.fillMiddleName();
  await fillingInfo.fillDOBgreater18();
  await continueButton.click();
  await reserveButton.click();
  await page.waitForURL(/\/visit/);
  await page.waitForTimeout(6000);
  await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible({ timeout: 25000 });

  await page.goto(`/visits`);
  await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).toBeVisible();
  // Locate the booking for the specific patient
  const booking = page.locator('.MuiGrid-container.appointment').filter({
    has: page.getByText(`${firstName} ${middleName} ${lastName}`),
  });
  // Check that the "Modify" button is present
  const modifyButton = booking.locator('button:has-text("Modify")');
  await expect(modifyButton).toBeVisible();
  // Check that the "Check In" button is present
  const checkInButton = booking.locator('button:has-text("Check In")');
  await expect(checkInButton).toBeVisible();
  // Check that the text "You are checked in" is present
  const checkInText = booking.locator('.check-in h6:has-text("Check in when you arrive")');
  await expect(checkInText).toBeVisible();
  // Check that the location is equal to the expected location
  const locationLocator = booking.locator('.location');
  const actualLocation = await locationLocator.innerText();
  const locationFromEnv = `${process.env.SLUG_ONE}`;
  expect(actualLocation.trim().toLowerCase()).toBe(locationFromEnv.toLowerCase());
  // Check that the text "Paperwork complete" is present
  const paperworkText = booking.locator('.paperwork h6:has-text("Paperwork incomplete")');
  await expect(paperworkText).toBeVisible();
  // Check that the "Cancel" button is hidden
  const cancelButton = booking.locator('button:has-text("Cancel")');
  await expect(cancelButton).toBeVisible();
  // Check that the "Edit" paperwork button is hidden
  const editButton = booking.locator('button:has-text("Edit")');
  await expect(editButton).not.toBeVisible();
  await cancelButton.click();
  await fillingInfo.cancelPrebookVisit();
  await page.goto(`/visits`);
  await expect(page.getByRole('button', { name: 'Visit details' }).first()).toBeVisible();
  await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).not.toBeVisible();
});
