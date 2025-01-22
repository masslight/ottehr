import { expect, test } from '@playwright/test';
import { login } from 'test-utils';
import { FillingInfo } from '../../utils/in-person/FillingInfo';

test('Should open home page', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveURL('/home');
});

test.skip('Selecting slot and logging in', async ({ page, context }) => {
  const logoutButton = page.locator('text=Logout');
  await context.clearCookies();
  const fillingInfo = new FillingInfo(page);
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  if (await logoutButton.isVisible()) {
    // Step 3: If the button is visible, click it
    await logoutButton.click();
    console.log('Logout button clicked');
  } else {
    console.log('Logout button not found');
  }
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook`);
  await fillingInfo.selectSlot();
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await continueButton.click();
  await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);
  // await expect(page.getByText('Thanks for choosing')).toBeVisible();
  console.log('Logged in!');
});

test('Should open patients page after sign in', async ({ page }) => {
  // TODO:
  // rather than process, will need to read these values from fhir and get the config for each active location
  // probably saving all available routes in some json file to be read from
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook/patients`);
  await expect(page.getByText('Loading...')).toHaveCount(0);
  await page.waitForTimeout(3000);
});

test.skip('Run for new user', async ({ page }) => {
  const fillingInfo = new FillingInfo(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
  await page.goto(`/location/${process.env.STATE_ONE}/${process.env.SLUG_ONE}/prebook/patients`);
  await expect(page.getByText('Loading...')).toHaveCount(0);
  await page.waitForTimeout(3000);
  await continueButton.click();
  await fillingInfo.fillNewPatientInfo();
  await fillingInfo.fillDOBgreater18();
  await continueButton.click();
  await reserveButton.click();
  await page.waitForURL(/\/visit/);
  await page.waitForTimeout(6000);
});
