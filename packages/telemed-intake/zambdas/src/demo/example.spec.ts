import { test, expect, Page } from '@playwright/test';
import { FhirClient, SearchParam } from '@zapehr/sdk';
import { DateTime } from 'luxon';
import { createFhirClient, getSecret, SecretsKeys, CreateAppointmentUCTelemedParams } from 'ottehr-utils';
import { checkOrCreateToken } from '../appointment/lib/utils';
import { getM2MClientToken } from '../shared';
import axios from 'axios';

test('get started link', async ({ page }) => {
  await page.goto('https://telemed.ottehr.com/location/test/in-person/prebook');
  const test = await demo(page);
  expect(test === 5);
});

async function demo(page: Page): Promise<number> {
  const zapehrToken = await getM2MClientToken(null);
  const fhirClient = createFhirClient(zapehrToken);
  let successes = 0;

  // configure how to get page phone and username and password
  const token = await getUser(
    page,
    getSecret(SecretsKeys.PHONE_NUMBER, null),
    getSecret(SecretsKeys.TEXT_USERNAME, null),
    getSecret(SecretsKeys.TEXT_PASSWORD, null),
  );

  for (let i = 0; i < 5; i++) {
    const randomPatientInfo = await generateRandomPatientInfo(fhirClient);
    const inputBody = JSON.stringify(randomPatientInfo);
    const TELEMED_CREATE_APPOINTMENT_ZAMBDA_ID = getSecret(SecretsKeys.TELEMED_CREATE_APPOINTMENT_ZAMBDA_ID, null);

    const response = await fetch(
      `https://project-api.zapehr.com/v1/zambda/${TELEMED_CREATE_APPOINTMENT_ZAMBDA_ID}/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: inputBody,
      },
    );

    const responseJSON = await response.json();
    console.log(responseJSON);
    if (response.status === 200) {
      successes += 1;
    }
  }
  return successes;
}

const generateRandomPatientInfo = async (fhirClient: FhirClient): Promise<CreateAppointmentUCTelemedParams> => {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown'];
  const sexes: ('male' | 'female' | 'other' | 'unknown')[] = ['male', 'female', 'other', 'unknown'];
  const visitTypes: ('prebook' | 'now')[] = ['prebook', 'now'];
  const visitServices: ('in-person' | 'telemedicine')[] = ['in-person', 'telemedicine'];

  const searchParams: SearchParam[] = [{ name: 'status', value: 'active' }];
  const availableLocations: any[] = await fhirClient?.searchResources({
    resourceType: 'Location',
    searchParams: searchParams,
  });

  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomEmail = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@example.com`;
  const randomDateOfBirth = DateTime.now()
    .minus({ years: Math.floor(Math.random() * 26) })
    .toISODate();
  const randomSex = sexes[Math.floor(Math.random() * sexes.length)];
  const randomLocationIndex = Math.floor(Math.random() * availableLocations.length);
  const randomLocationId = availableLocations[randomLocationIndex].id;

  return {
    patient: {
      newPatient: true,
      firstName: randomFirstName,
      lastName: randomLastName,
      dateOfBirth: randomDateOfBirth,
      sex: randomSex,
      email: randomEmail,
      emailUser: 'Patient',
    },
    slot: DateTime.now()
      .plus({ days: Math.floor(Math.random() * 30) })
      .toISO(),
    scheduleType: 'location',
    visitType: visitTypes[Math.floor(Math.random() * visitTypes.length)],
    visitService: visitServices[Math.floor(Math.random() * visitServices.length)],
    locationID: randomLocationId,
    timezone: 'UTC',
  };
};

export async function getUser(
  page: Page,
  phone: string,
  text_username: string,
  text_password: string,
): Promise<string> {
  console.log('Logging in...');
  const slotButton = page.getByRole('button', { name: 'First available' });
  await slotButton.click();
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await continueButton.click();
  const countryCodeButton = page.locator('button[value="pick-country-code"]');
  await countryCodeButton.click();
  const us1Button = page.locator('button[value="selection-action::US1"]');
  await us1Button.click();
  const phoneInput = page.locator('#username');
  await phoneInput.fill(phone.substring(2) || ''); // Don't include +1 in number
  let token = '';
  page.on('request', async (request) => {
    if (request.url().startsWith('https://project-api.zapehr.com/v1/zambda/')) {
      console.log(await request.allHeaders());
      if ('authorization' in request.headers()) {
        console.log(request.headers()['authorization']);
        token = request.headers()['authorization'].replace('Bearer ', '');
      }
    }
  });

  // Select the button with the text Continue
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
    if (code) {
      break;
    }
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
  await page.waitForTimeout(500);
  console.log(1, token);
  return token;
}

async function getCode(
  authenticationBegin: DateTime,
  text_username: string,
  text_password: string,
): Promise<string | undefined> {
  const basicAuthorization = btoa(`${text_username}:${text_password}`);
  const inboundSMS = await axios({
    url: `https://rest.clicksend.com/v3/sms/history?date_from=${authenticationBegin.minus({ seconds: 10 }).toSeconds()}`,
    method: 'get',
    headers: {
      Authorization: `Basic ${basicAuthorization}`,
    },
  });
  console.log(inboundSMS);
  // const sms = inboundSMS.data.data.data.find((sms: any) => {
  //   const smsDate = DateTime.fromSeconds(sms.date);
  //   console.log(smsDate.toISO(), authenticationBegin.toISO());
  //   console.log(sms.body);
  //   return smsDate > authenticationBegin;
  // });
  const sms = inboundSMS.data.data.data[0];
  console.log(sms);
  if (!sms?.body) return undefined;
  const matches = new RegExp(/code is: (\w+)/).exec(sms.body);
  return matches?.at(1);
}
