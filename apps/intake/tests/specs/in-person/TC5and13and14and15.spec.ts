import { expect, test } from '@playwright/test';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test.skip('TC15 Check options for patient <=> 18', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const newPatient = page.getByText('Different family member');
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await fillingInfo.selectSlot();
  await page.waitForTimeout(3000);
  await continueButton.click();
  await continueButton.click();
  await newPatient.click();
  await continueButton.click();
  await fillingInfo.fillDOBless18();
  await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
  await expect(page.getByText('Patient', { exact: true })).toBeHidden();
  await page.waitForTimeout(3000);
  await fillingInfo.fillDOBgreater18();
  await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
  await expect(page.getByText('Patient', { exact: true })).toBeVisible();
  await page.waitForTimeout(3000);
  await fillingInfo.fillDOBequal18();
  await expect(page.getByText('Parent/Guardian', { exact: true })).toBeVisible();
  await expect(page.getByText('Patient', { exact: true })).toBeVisible();
});

test.skip('TC5 Age range validation', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const newPatient = page.getByText('Different family member');
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await fillingInfo.selectSlot();
  await page.waitForTimeout(3000);
  await continueButton.click();
  await continueButton.click();
  await newPatient.click();
  await continueButton.click();
  await fillingInfo.fillNewPatientInfo();
  await fillingInfo.fillDOBgreater26();
  await continueButton.click();
  await expect(page.getByText('Age not in range')).toBeVisible();
});
