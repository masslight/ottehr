import { expect, Page } from '@playwright/test';
import axios from 'axios';
import { DateTime } from 'luxon';

// timeouts: for sms 24 attempts * 15 seconds = 6 minutes, + 45 seconds for setting local storage in login function
export async function login(page: Page, phone?: string, text_username?: string, text_password?: string): Promise<void> {
  if (!phone || !text_username || !text_password)
    throw new Error('Either phone, text_username or text_password was not provided');

  console.log('Starting authentication flow...');

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
  const latestCode = await getLatestCode(now, text_username, text_password);

  if (!latestCode) {
    throw new Error('No code received from SMS service');
  }

  console.log(`Trying code: ${latestCode}`);

  const codeInput = page.locator('#code');
  await codeInput.clear();
  await codeInput.fill(latestCode);

  const verifyButton = page.locator('button:has-text("Continue")');
  await verifyButton.click();

  expect(await page.getByText('Code is invalid').isVisible({ timeout: 5000 })).toBeFalsy();

  try {
    // optional third party modal which may appear, it's tricky to handle, because text may be different, currently we just click on accept button, but maybe we can find a better way to handle it
    const acceptButton = page.getByRole('button', { name: 'Accept' });
    await acceptButton.waitFor({ state: 'visible', timeout: 5000 });
    console.log('[INFO] Accepting authorization...');
    await acceptButton.click();
  } catch {
    console.log('[INFO] No accept button found, continuing...');
  }

  // todo: fix import from packages to import dataTestIds from ui-components
  await expect(page.locator(`[data-testid="header-for-authenticated-user"]`)).toBeVisible({
    timeout: 10_000,
  });

  console.log(`[SUCCESS] Code ${latestCode} is valid!`);

  // Wait for the token to be saved in localStorage
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

  console.log('[SUCCESS] Authentication completed successfully');
}

async function getLatestCode(
  authenticationBegin: DateTime,
  text_username: string,
  text_password: string
): Promise<string | null> {
  const basicAuthorization = btoa(`${text_username}:${text_password}`);
  const maxCodeRetries = 24;
  const retryInterval = 15_000; // 15 seconds

  for (let codeAttempt = 1; codeAttempt <= maxCodeRetries; codeAttempt++) {
    console.log(
      `[CODE_ATTEMPT ${codeAttempt}/${maxCodeRetries}] Waiting ${retryInterval}ms before checking for code...`
    );
    await new Promise((resolve) => setTimeout(resolve, retryInterval));

    try {
      console.log(`[INFO] Request SMS history from: ${authenticationBegin.toISO()}`);

      const inboundSMS = await axios({
        url: `https://rest.clicksend.com/v3/sms/history?date_from=${authenticationBegin.toSeconds()}`,
        method: 'get',
        headers: {
          Authorization: `Basic ${basicAuthorization}`,
        },
      });

      console.log(`[SUCCESS] Successfully received response from ClickSend API. Status: ${inboundSMS.status}`);

      const smsData = inboundSMS.data?.data?.data;

      if (!Array.isArray(smsData) || smsData.length === 0) {
        console.log(`[CODE_ATTEMPT ${codeAttempt}] No SMS data in response, retrying...`);
        continue;
      }

      // Sort SMS by date (newest first)
      smsData.sort((a, b) => (b.date || 0) - (a.date || 0));

      const codeRegex = /code is: (\w+)/i;

      // Find the latest code
      for (const sms of smsData) {
        if (sms?.body) {
          const matches = codeRegex.exec(sms.body);
          if (matches?.at(1)) {
            const code = matches[1];
            console.log(`[CODE_FOUND] Latest code found: "${code}"`);
            return code;
          }
        }
      }

      console.log(`[CODE_ATTEMPT ${codeAttempt}] No valid code found in SMS, retrying...`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ERROR] Error while receiving SMS history (attempt ${codeAttempt}): ${errorMessage}`);

      if (axios.isAxiosError(error)) {
        console.error(`[ERROR] Response status: ${error.response?.status}`);
        console.error(`[ERROR] Response data:`, error.response?.data);
      }
    }
  }

  console.log(`[ERROR] Failed to get code after ${maxCodeRetries} attempts`);
  return null;
}
