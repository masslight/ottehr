import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test.skip('TC39 Walk-in Review and submit screen', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
  //await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible();
  await fillingInfo.WalkinInformationAsProceed();
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
  const dateTime = DateTime.now().toFormat('MMMM d, h:mm a ZZZZ');
  await expect(page.getByText(`${dateTime}`)).toBeVisible();
});

test.skip('TC40 Walk-in Thank you screen', async ({ page, context }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible();
  await fillingInfo.WalkinInformationAsProceed();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Different family member' })).toBeVisible();
  await page.getByRole('heading', { name: 'Different family member' }).click();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
  await fillingInfo.fillNewPatientInfo();
  await fillingInfo.fillDOBless18();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this walk-in time' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr In Person!' })).toBeVisible({
    timeout: 25000,
  });
  await expect(page.getByText('We look forward to helping you soon!')).toBeHidden();
  await expect(page.getByText('Your check-in time is booked for:')).toBeVisible();
  await expect(page.getByText('Please proceed to paperwork.')).toBeVisible();
  await expect(page.getByText('If not completed, your care may be delayed.')).toBeVisible();
  await expect(
    page.getByText('If you have any questions or concerns, please call our team at: (631) 696-5437')
  ).toBeVisible();
  await expect(page.getByText(`${process.env.SLUG_ONE}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Modify' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Register another patient' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible();
  const nowInEDT = DateTime.now().setZone('America/New_York');
  const format = 'LLLL d, h:mm a ZZZZ';
  const formattedDateTime = nowInEDT.toFormat(format);
  await expect(page.getByText(`${formattedDateTime}`)).toBeVisible();
  const pagePromise = context.waitForEvent('page');
  await page.getByText('here').click();
  const newPage = await pagePromise;
  await newPage.waitForLoadState();
  await expect(newPage).toHaveURL('https://ottehr.com/financial-policy/');
  await page.getByRole('button', { name: 'Register another patient' }).click();
  await expect(page).toHaveURL(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
});
