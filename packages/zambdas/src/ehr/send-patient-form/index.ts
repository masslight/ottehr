import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, Questionnaire } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { sendSmsForPatient } from '../../shared/communication';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'send-patient-form';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const { appointmentId, questionnaireId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const questionnaire = await oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: questionnaireId });
  if (!questionnaire) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Could not find the Questionnaire/${questionnaireId}`);

  const questionnaireName = questionnaire.title || 'a form';

  const resources = (
    await oystehr.fhir.search<Encounter | Patient>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: `Appointment/${appointmentId}` },
        { name: '_include', value: 'Encounter:subject' },
      ],
    })
  ).unbundle();

  const patient = resources.find((r) => r.resourceType === 'Patient');

  if (!patient) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Could not find the patient resource for Appointment/${appointmentId}`);
  }

  // Build the form URL. Patient-level links omit the appointment segment.
  const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const formUrl = `${websiteUrl}/forms/${appointmentId}/${questionnaireId}`;

  // Send SMS to the patient
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const message = `Please complete ${questionnaireName} for your visit: ${formUrl}`;
  await sendSmsForPatient(message, oystehr, patient, ENVIRONMENT);

  console.log(`Form link sent to Patient/${patient.id}: ${formUrl}`);

  return {
    statusCode: 200,
    body: JSON.stringify('Form SMS sent successfully'),
  };
});
