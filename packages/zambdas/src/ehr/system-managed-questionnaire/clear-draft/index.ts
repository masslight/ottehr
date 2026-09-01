import { BatchInputDeleteRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { ClearSystemManagedDraftOutput } from 'utils/lib/types/data/system-managed-questionnaires/system-managed-questionnaire.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { findSystemManagedDrafts } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'system-managed-questionnaire-clear-draft';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { url, secrets } = validateRequestParameters(input);
  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const drafts = await findSystemManagedDrafts(oystehr, url);
  const deleteRequests: BatchInputDeleteRequest[] = drafts
    .filter((d) => d.id)
    .map((d) => ({ method: 'DELETE', url: `Questionnaire/${d.id}` }));

  if (deleteRequests.length > 0) {
    console.log(`Clearing ${deleteRequests.length} draft(s) for ${url}`);
    await oystehr.fhir.transaction<Questionnaire>({ requests: deleteRequests });
  } else {
    console.log(`No drafts to clear for ${url}`);
  }

  const response: ClearSystemManagedDraftOutput = { cleared: deleteRequests.length > 0 };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
