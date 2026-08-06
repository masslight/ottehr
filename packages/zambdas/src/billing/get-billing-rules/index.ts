import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { BillingRulesResponse } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { RulesEngineType } from 'utils/lib/types/data/billing/rules-engine.constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { createBillingClient, findRulesEngineList, listToRulesReportingMalformed } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-rules';

// Returns the requested engine's ordered rules (and the List versionId for optimistic locking on save).
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const list = await complexValidation(oystehr, params.engine);
  const response = await performEffect(list, getSecret(SecretsKeys.ENVIRONMENT, params.secrets));
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function complexValidation(oystehr: Oystehr, engine: RulesEngineType): Promise<List | undefined> {
  return findRulesEngineList(oystehr, engine);
}

async function performEffect(list: List | undefined, env: string): Promise<BillingRulesResponse> {
  if (!list) return { rules: [] };
  return { rules: await listToRulesReportingMalformed(list, env), versionId: list.meta?.versionId };
}
