import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { sendSmsForPatient } from '../../shared/communication';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('send-patient-form', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentId, patientId, questionnaireId, questionnaireName, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  // Resolve the patient from either an appointment's encounter or a direct patientId.
  let resolvedPatientId = patientId;
  if (!resolvedPatientId && appointmentId) {
    const encounters = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
      })
    ).unbundle();
    if (encounters.length === 0) {
      // appointmentId is caller-supplied; a bad/stale id is user-actionable, not a page.
      throw FHIR_RESOURCE_NOT_FOUND('Encounter');
    }
    const patientRef = encounters[0].subject?.reference;
    if (!patientRef) {
      throw new Error('Encounter has no patient reference');
    }
    resolvedPatientId = patientRef.replace('Patient/', '');
  }

  if (!resolvedPatientId) {
    throw new Error('Could not resolve patient');
  }

  const patient = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: resolvedPatientId,
  });

  // Build the form URL. Patient-level links omit the appointment segment.
  const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const formUrl = appointmentId
    ? `${websiteUrl}/forms/${appointmentId}/${questionnaireId}`
    : `${websiteUrl}/forms/patient/${resolvedPatientId}/${questionnaireId}`;

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
