import { Secrets } from 'ottehr-utils';
import { getM2MClientToken } from '../../shared';
import { DateTime } from 'luxon';
import axios from 'axios';
import { Page, expect } from '@playwright/test';

export async function checkOrCreateToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting token');
    return await getM2MClientToken(secrets);
  } else {
    console.log('already have token');
    return token;
  }
}

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
  await phoneInput.fill(phone.substring(2) || '');

  const now = DateTime.now();
  const authLoginContinueButton = page.locator('button:has-text("Continue")');
  await authLoginContinueButton.click();
  let n = 0;
  let code: string | undefined = '';
  while (n < 7) {
    n++;
    await page.waitForTimeout(2000);
    code = await getCode(now, text_username, text_password);
    console.log(code);
    if (code) break;
  }

  if (!code) {
    throw new Error("Couldn't receive verification code with sms. Exceeded retries count");
  }

  const codeInput = page.locator('#code');
  await codeInput.fill(code);
  const verifyButton = page.locator('button:has-text("Continue")');
  await verifyButton.click();
  await page.waitForTimeout(3000);
  expect(await page.getByText('Code is invalid').isVisible()).toBeFalsy();
  await page.context().storageState({ path: 'playwright/user.json' });
}

async function getCode(
  authenticationBegin: DateTime,
  text_username: string,
  text_password: string,
): Promise<string | undefined> {
  const basicAuthorization = btoa(`${text_username}:${text_password}`);
  const inboundSMS = await axios({
    url: `https://rest.clicksend.com/v3/sms/history?date_from=${authenticationBegin.minus({ minutes: 1 }).toSeconds()}`,
    method: 'get',
    headers: {
      Authorization: `Basic ${basicAuthorization}`,
    },
  });
  console.log(inboundSMS);
  const sms = inboundSMS.data.data.data[0];
  console.log(sms);
  if (!sms?.body) return undefined;
  const matches = new RegExp(/code is: (\w+)/).exec(sms.body);
  return matches?.at(1);
}
