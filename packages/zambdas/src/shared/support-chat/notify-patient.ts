import Oystehr from '@oystehr/sdk';
import { Location, Patient } from 'fhir/r4b';
import { getFirstName, getPatientContactEmail } from 'utils/lib/fhir/patient';
import { convertOutreachTextToHtml } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { getEmailClient, sendSmsForPatient } from '../communication';
import { sendErrors } from '../errors';

export async function notifyPatient(input: {
  patient: Patient;
  location?: Location;
  secrets: Secrets | null;
  oystehr: Oystehr;
}): Promise<void> {
  const { patient, location, secrets, oystehr } = input;
  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  try {
    const firstName = getFirstName(patient) ?? '';
    const portalUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
    const email = getPatientContactEmail(patient);

    if (!email) {
      await sendSmsForPatient(
        `Hi ${firstName}, you have a new message in your patient portal. Log in to view it: ${portalUrl}`,
        oystehr,
        patient,
        environment
      );

      return;
    }

    const phone = location?.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;

    const content = [
      `Hi ${firstName},`,
      'A staff member has sent you a message regarding your request. Log in to your patient portal to view it.',
      `[Log In](${portalUrl})`,
      ...(phone ? [`If you have questions, please contact us at ${phone}.`] : []),
    ].join('\n');

    await getEmailClient(secrets).sendGenericOutreachEmail(email, {
      content: convertOutreachTextToHtml(content),
      'subject-text': `You have a new message from ${location?.name ?? 'your clinic'}`,
    });
  } catch (error) {
    console.error('Failed to notify patient about a support chat message', error);

    await sendErrors(error, environment);
  }
}
