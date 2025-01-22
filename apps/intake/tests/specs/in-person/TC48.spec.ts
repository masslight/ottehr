import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { DateTime } from 'luxon';
import { UIDesign } from '../../utils/in-person/UIdesign';
import { UploadImage } from '../../utils/in-person/UploadImage';

test.skip('TC48 "You are checked in!" screen paperwork missing and completed', async ({ page, context }) => {
  const fillingInfo = new FillingInfo(page);
  const UIdesign = new UIDesign(page);
  const uploadPhoto = new UploadImage(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible();
  await page.getByRole('heading', { name: 'I am the Parent or legal' }).click();
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
  await fillingInfo.fillDOBgreater18();
  await continueButton.click();
  const nowInEDT = DateTime.now().setZone('America/New_York');
  const format = 'LLLL d, h:mm a ZZZZ';
  const formattedDateTime = nowInEDT.toFormat(format);
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await expect(page.getByText('Review and confirm all details below.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visit details' })).toBeVisible();
  await expect(page.getByText('Patient')).toBeVisible();
  await expect(page.getByText('Office')).toBeVisible();
  await expect(page.getByText('Walk-in time', { exact: true })).toBeVisible();
  await expect(page.getByText(`${firstName} ${middleName} ${lastName}`)).toBeVisible();
  await expect(page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this walk-in time' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this walk-in time' }).click();
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
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible();
  await fillingInfo.fillConsentForm();
  await continueButton.click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await UIdesign.WalkinCheckInScreenPaperworkMissing();
  await expect(page.getByText(`${formattedDateTime}`)).toBeVisible();
  // Verify the link is correct
  const link = await page.locator('a.appointments-button');
  await expect(link).toHaveAttribute('href', 'https://www.example.com/survey');
  // Listen for the new page (tab) event
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    link.click(), // Click the link which opens a new tab
  ]);
  // Check the URL of the new tab
  await newPage.waitForLoadState('load');
  expect(newPage.url()).toBe('https://www.example.com/survey');
  // Close the new tab
  await newPage.close();
  // COMPLETE PAPERWORK FLOW
  await page.getByRole('link', { name: 'Complete paperwork' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit paperwork' }).click();
  await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Patient details' })).toBeVisible();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'How would you like to pay for' })).toBeVisible();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Responsible party information' })).toBeVisible();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Photo ID' })).toBeVisible();
  await uploadPhoto.fillPhotoFrontID();
  await uploadPhoto.fillPhotoBackID();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Complete consent forms' })).toBeVisible({ timeout: 25000 });
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  //await expect(page.getByText('Your paperwork is complete')).toBeVisible({ timeout: 25000 });
  await UIdesign.WalkinCheckInScreenPaperworkComplete();
});
