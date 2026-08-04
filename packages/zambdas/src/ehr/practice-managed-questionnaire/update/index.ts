import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { MANAGED_QUESTIONNAIRE_ERROR, PAPERWORK_FLOW_TAG, practiceManagedQuestionnaireToFhir } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getCanonicalUrlFromQ, searchActiveQuestionnairesByTag } from '../../paperwork-flow/shared';
import { handleFormInFlows, patchQuestionnaireVersion } from '../helpers';
import { validateQuestionnaire, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-update';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { updateType, data, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // only practice managed questionnaires can be updated via this endpoint
  await validateQuestionnaire(validatedParameters, oystehr);

  let questionnaireIdToReturn: string | undefined;

  if (updateType === 'update-status') {
    const { questionnaireId, newStatus } = data;
    questionnaireIdToReturn = questionnaireId;

    if (newStatus === 'retired') await validateFormIsExcludedFromFlows(questionnaireId, oystehr);

    console.log(`patching questionnaire status to ${newStatus} for Questionnaire/${questionnaireId}`);
    await updateQuestionnaireStatus(questionnaireId, newStatus, oystehr);
  } else if (updateType === 'update-questionnaire') {
    const { id: previousId, version: previousVersion, ...rest } = data;

    const nextVersion = patchQuestionnaireVersion(previousVersion);
    console.log('nextVersion', nextVersion);

    console.log('configuring post request for updated resource');
    const fhirQuestionnaire = practiceManagedQuestionnaireToFhir({
      ...rest,
      version: nextVersion,
    });

    const updatedQPostRequest: BatchInputPostRequest<Questionnaire> = {
      method: 'POST',
      url: '/Questionnaire',
      resource: fhirQuestionnaire,
    };

    console.log('configuring patch request for previous resource version');
    const supersedeQPatchRequest: BatchInputPatchRequest<Questionnaire> = {
      method: 'PATCH',
      url: `Questionnaire/${previousId}`,
      operations: [{ op: 'replace', path: '/status', value: 'retired' }],
    };

    console.log('checking if form is contained in any flows');
    const flowRequests: BatchInputRequest<Questionnaire>[] = await handleFormInFlows({
      previousVersion,
      nextVersion,
      url: rest.url,
      oystehr,
    });
    console.log(
      `Flows containing the target form that will be updated: ${
        flowRequests.length > 0 ? `${flowRequests.map((request) => request.url)}` : 'none'
      }`
    );

    console.log(`Creating version ${nextVersion} of "${rest.url}", "superseding" Questionnaire/${previousId}`);
    const res = (
      await oystehr.fhir.transaction<Questionnaire>({
        requests: [supersedeQPatchRequest, updatedQPostRequest, ...flowRequests],
      })
    ).unbundle();

    questionnaireIdToReturn = res.find(
      (resource): resource is Questionnaire =>
        resource.resourceType === 'Questionnaire' && resource.version === nextVersion
    )?.id;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ questionnaireId: questionnaireIdToReturn }),
  };
});

async function validateFormIsExcludedFromFlows(formQId: string, oystehr: Oystehr): Promise<void> {
  console.log('checking if the form is contained in any flows before retiring');
  const [targetFormQ, flowQuestionnaires] = await Promise.all([
    oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: formQId }),
    searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
  ]);

  const canonicalUrl = getCanonicalUrlFromQ(targetFormQ);
  const contained = flowQuestionnaires.filter((q) => {
    return q.derivedFrom?.some((url) => url === canonicalUrl);
  });

  if (contained.length > 0) {
    const flowsImpacted = contained.map((flow) => flow.title);
    throw MANAGED_QUESTIONNAIRE_ERROR(
      `This form is contained in a paperwork flow, please remove it from the following: ${flowsImpacted.join(', ')}`
    );
  }
  console.log('safe to retire');
}

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
