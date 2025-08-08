import { randomUUID } from 'crypto';
import fs from 'fs';
import { DateTime } from 'luxon';
import { DATETIME_FULL_NO_YEAR } from 'utils';
import { getEmailClient } from '../shared';

const to = 'your email here';
const randomVisitId = randomUUID();

const inPersonConfirmationTestInput = {
  location: 'Manassas',
  time: DateTime.now().toFormat(DATETIME_FULL_NO_YEAR),
  address: '123 Main St, Manassas, VA 20110',
  'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI('123 Main St, Manassas, VA 20110')}`,
  'modify-visit-url': `ottehr.com/visit/${randomVisitId}/reschedule`,
  'cancel-visit-url': `ottehr.com/visit/${randomVisitId}/cancel`,
  'paperwork-url': `ottehr.com/paperwork/${randomVisitId}`,
};

const testEmails = async (envConfig: any): Promise<void> => {
  try {
    const emailClient = getEmailClient(envConfig);
    await emailClient.sendInPersonConfirmationEmail(to, inPersonConfirmationTestInput);
  } catch (e) {
    console.log('email test threw error:', e);
  }
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await testEmails(envConfig);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
