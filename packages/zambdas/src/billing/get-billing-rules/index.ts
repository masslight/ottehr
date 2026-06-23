import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { BillingRulesResponse, listToRules, PRESUBMISSION_RULES_LIST_CODE, RULES_ENGINE_TAG_SYSTEM } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-rules';

// Returns the ordered pre-submission rules (and the List versionId for optimistic locking on save).
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await performEffect(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr): Promise<BillingRulesResponse> {
  const result = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: '_tag', value: `${RULES_ENGINE_TAG_SYSTEM}|${PRESUBMISSION_RULES_LIST_CODE}` }],
  });
  const list = result.unbundle()[0];
  if (!list) return { rules: [] };
  return { rules: listToRules(list), versionId: list.meta?.versionId };
}
