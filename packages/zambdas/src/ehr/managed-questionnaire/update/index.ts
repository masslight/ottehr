import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { managedQuestionnaireToFhir } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../../shared';
import { wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'managed-questionnaire-update';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const validatedParameters = validateRequestParameters(input);

  const { updateType, data, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  if (updateType === 'update-status') {
    const { questionnaireId, newStatus } = data;

    console.log(`patching questionnaire status to ${newStatus} for Questionnaire/${questionnaireId}`);
    await updateQuestionnaireStatus(questionnaireId, newStatus, oystehr);
  } else if (updateType === 'update-questionnaire') {
    const fhirQuestionnaire = managedQuestionnaireToFhir(data);

    console.log(`Updating Questionnaire/${fhirQuestionnaire.id}`);
    await oystehr.fhir.update<Questionnaire>(fhirQuestionnaire);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

async function updateQuestionnaireStatus(
  questionnaireId: string,
  status: Questionnaire['status'],
  oystehr: Oystehr
): Promise<void> {
  await oystehr.fhir.patch<Questionnaire>({
    resourceType: 'Questionnaire',
    id: questionnaireId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: status,
      },
    ],
  });
  console.log('success');
}
