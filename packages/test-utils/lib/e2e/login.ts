import { Page, expect } from '@playwright/test';
import axios from 'axios';
import { DateTime } from 'luxon';

export async function login(page: Page, phone?: string, text_username?: string, text_password?: string): Promise<void> {
  if (!phone || !text_username || !text_password)
    throw new Error('Either phone, text_username or text_password was not provided');

  console.log('Logging in...');
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await continueButton.click();
  const countryCodeButton = page.locator('button[value="pick-country-code"]');
  await countryCodeButton.click();
  const us1Button = page.locator('button[value="selection-action::US1"]');
  await us1Button.click();
  const phoneInput = page.locator('#username');
  await phoneInput.fill(phone.substring(2) || ''); // Don't include +1 in number
  const now = DateTime.now();
  const authLoginContinueButton = page.locator('button:has-text("Continue")');
  await authLoginContinueButton.click();
  let n = 0;
  let code: string | undefined = '';
  while (n < 3) {
    n++;
    await page.waitForTimeout(10000);
    code = await getCode(now, text_username, text_password);
    if (code) break;
  }

  if (!code) {
    throw new Error("Couldn't receive verification code with sms. Exceeded retries count");
  }

  const codeInput = page.locator('#code');
  await codeInput.fill(code);
  const verifyButton = page.locator('button:has-text("Continue")');
  await verifyButton.click();
  await page.waitForTimeout(5000);
  expect(await page.getByText('Code is invalid').isVisible()).toBeFalsy();

  if (await page.getByText('Authorize App').isVisible()) {
    const acceptButton = page.locator('button:has-text("Accept")');
    await acceptButton.click();
  }

  // we kepp auth0 token in the LS so we need to wait for it to be set and then we can save the context
  await expect(async () => {
    const token = await page.evaluate(() => Object.keys(localStorage).find((key) => key.includes('auth0')));
    if (!token) {
      throw new Error('Auth0 token is not set');
    }
    await page.context().storageState({ path: './playwright/user.json' });
  }).toPass({
    timeout: 15000,
    intervals: [3000],
  });
}

async function getCode(
  authenticationBegin: DateTime,
  text_username: string,
  text_password: string
): Promise<string | undefined> {
  const basicAuthorization = btoa(`${text_username}:${text_password}`);

  const inboundSMS = await axios({
    url: `https://rest.clicksend.com/v3/sms/history?date_from=${authenticationBegin.minus({ minutes: 1 }).toSeconds()}`,
    method: 'get',
    headers: {
      Authorization: `Basic ${basicAuthorization}`,
    },
  });

  const sms = inboundSMS.data.data.data[0];

  if (!sms?.body) return undefined;

  const matches = new RegExp(/code is: (\w+)/).exec(sms.body);
  return matches?.at(1);
}
