import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { BillingRulesResponse, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, findPresubmissionRulesList, listToRulesReportingMalformed } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-rules';

// Returns the ordered pre-submission rules (and the List versionId for optimistic locking on save).
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const list = await complexValidation(oystehr);
  const response = await performEffect(list, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function complexValidation(oystehr: Oystehr): Promise<List | undefined> {
  return findPresubmissionRulesList(oystehr);
}

async function performEffect(list: List | undefined, env: string): Promise<BillingRulesResponse> {
  if (!list) return { rules: [] };
  return { rules: await listToRulesReportingMalformed(list, env), versionId: list.meta?.versionId };
}
