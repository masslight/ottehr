import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  getPatchOperationToRemoveMetaTags,
  PRACTICE_MANAGED_QUESTIONNAIRE_LATEST_TAG,
  practiceManagedQuestionnaireToFhir,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-update';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { updateType, data, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let questionnaireIdToReturn: string | undefined;

  if (updateType === 'update-status') {
    const { questionnaireId, newStatus } = data;
    questionnaireIdToReturn = questionnaireId;

    console.log(`patching questionnaire status to ${newStatus} for Questionnaire/${questionnaireId}`);
    await updateQuestionnaireStatus(questionnaireId, newStatus, oystehr);
  } else if (updateType === 'update-questionnaire') {
    const { id: previousId, version: previousVersion, ...rest } = data;
    const nextVersion = (parseInt(previousVersion) + 1).toString();
    console.log('nextVersion', nextVersion);

    console.log('getting the previous version resource');
    const previousVersionQuestionnaire = await oystehr.fhir.get<Questionnaire>({
      resourceType: 'Questionnaire',
      id: previousId ?? '',
    });

    console.log('configuring post request for updated resource');
    const fhirQuestionnaire = practiceManagedQuestionnaireToFhir({
      ...rest,
      version: nextVersion,
      derivedFrom: [`${rest.url}|${previousVersion ?? '1'}`],
    });
    const updatedQPostRequest: BatchInputPostRequest<Questionnaire> = {
      method: 'POST',
      url: '/Questionnaire',
      resource: fhirQuestionnaire,
    };

    console.log('configuring patch request for previous resource version');
    const removeLatestPatchOp = getPatchOperationToRemoveMetaTags(previousVersionQuestionnaire, [
      PRACTICE_MANAGED_QUESTIONNAIRE_LATEST_TAG,
    ]);
    const supersedeQPatchRequest: BatchInputPatchRequest<Questionnaire> = {
      method: 'PATCH',
      url: `Questionnaire/${previousId}`,
      operations: [removeLatestPatchOp, { op: 'replace', path: '/status', value: 'retired' }],
    };

    // superseding equates to removing latest tag and marking as retired
    // need to differentiate from just retired because Qs marked as retired AND latest can be restored
    console.log(`Creating version ${nextVersion} of "${rest.url}", "superseding" Questionnaire/${previousId}`);
    const res = (
      await oystehr.fhir.transaction<Questionnaire>({
        requests: [supersedeQPatchRequest, updatedQPostRequest],
      })
    ).unbundle();

    questionnaireIdToReturn = res.find((resource) => resource.version === nextVersion)?.id;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ questionnaireId: questionnaireIdToReturn }),
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
