import { expect, test } from '@playwright/test';
import { login } from 'test-utils';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test.skip('TC53 Walkin not logged in', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/walkin`);
  await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  await expect(page.getByText('Are you filling out this information as:')).toBeVisible();
  await expect(page.getByText('I am the Parent or legal guardian of the minor patient')).toBeVisible();
  await expect(page.getByText('I am the Patient')).toBeVisible();
  await expect(
    page.getByText('I am NOT the parent or legal guardian but have permission to bring the minor patient for care')
  ).toBeVisible();
  await page.getByRole('heading', { name: 'I am the Parent or legal' }).click();
  await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Different family member' })).toBeVisible();
  await page.getByRole('heading', { name: 'Different family member' }).click();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'About the patient' })).toBeVisible();
  const parentGuardianRadio = page.locator('input[name="emailUser"][value="Parent/Guardian"]');
  await expect(parentGuardianRadio).toBeChecked();
  const patientName = await fillingInfo.fillNewPatientInfo();
  const PatientMail = patientName.email;
  await fillingInfo.fillDOBgreater18();
  await continueButton.click();
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
  await expect(page.getByText('Review and confirm all details below.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visit details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm this walk-in time' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this walk-in time' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for choosing Ottehr' })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Proceed to Paperwork' })).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: 'Proceed to Paperwork' }).click();
  await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
  const emailInput = page.locator('[id="guardian-email"]');
  await expect(emailInput).toHaveValue(PatientMail);
});
