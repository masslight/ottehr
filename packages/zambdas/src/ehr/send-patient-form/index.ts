import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getSecret,
  isPracticeManagedQr,
  PRACTICE_MANAGED_QR_TAG,
  SecretsKeys,
  SendPatientFormOutput,
} from 'utils';
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

  const canonicalUrl = `${questionnaire.url}|${questionnaire.version}`;

  const questionnaireName = questionnaire.title || 'a form';

  const resources = (
    await oystehr.fhir.search<Encounter | Patient | QuestionnaireResponse>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: `Appointment/${appointmentId}` },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_revinclude', value: 'QuestionnaireResponse:encounter' },
      ],
    })
  ).unbundle();

  const patient = resources.find((r) => r.resourceType === 'Patient');
  const encounter = resources.find((r) => r.resourceType === 'Encounter');
  const questionnaireResponses = resources
    .filter((r) => r.resourceType === 'QuestionnaireResponse')
    .filter((r) => isPracticeManagedQr(r) && r.questionnaire === canonicalUrl && r.status === 'in-progress');

  if (!patient) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Could not find the patient resource for Appointment/${appointmentId}`);
  }
  if (!encounter) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Could not find the encounter resource for Appointment/${appointmentId}`);
  }

  let questionnaireResponseId = questionnaireResponses?.[0]?.id;

  if (!questionnaireResponseId) {
    console.log('no existing form found, creating a new one');

    // create the QR
    const newQr: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      meta: { tag: [PRACTICE_MANAGED_QR_TAG] },
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
      status: 'in-progress',
      subject: { reference: `Patient/${patient.id}` },
      encounter: { reference: `Encounter/${encounter.id}` },
      item: questionnaire.item?.map((item) => {
        return {
          linkId: item.linkId,
          item: [],
        };
      }),
    };

    const created = await oystehr.fhir.create<QuestionnaireResponse>(newQr);
    questionnaireResponseId = created.id;
  }

  // Build the form URL. Patient-level links omit the appointment segment.
  const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const formUrl = `${websiteUrl}/forms/${questionnaireResponseId}`;

  // Send SMS to the patient
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const message = `Please complete ${questionnaireName} for your visit: ${formUrl}`;
  await sendSmsForPatient(message, oystehr, patient, ENVIRONMENT);

  console.log(`Form link sent to Patient/${patient.id}: ${formUrl}`);

  const response: SendPatientFormOutput = {
    questionnaireResponseId,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
