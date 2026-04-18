import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { sendSmsForPatient } from '../../shared/communication';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('send-patient-form', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentId, questionnaireId, questionnaireName, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  // Find the encounter for this appointment
  const encounters = (
    await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
    })
  ).unbundle();

  if (encounters.length === 0) {
    throw new Error(`No encounter found for appointment ${appointmentId}`);
  }

  const encounter = encounters[0];
  const patientRef = encounter.subject?.reference;
  if (!patientRef) {
    throw new Error('Encounter has no patient reference');
  }

  const patient = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: patientRef.replace('Patient/', ''),
  });

  // Build the form URL
  const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const formUrl = `${websiteUrl}/forms/${appointmentId}/${questionnaireId}`;

  // Send SMS to the patient
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const message = `Please complete ${questionnaireName} for your visit: ${formUrl}`;
  await sendSmsForPatient(message, oystehr, patient, ENVIRONMENT);

  console.log(`Form link sent to patient ${patient.id}: ${formUrl}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      formUrl,
      messageSent: true,
    }),
  };
});
