import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingCodeOption } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { SearchBillingProcedureCodesParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-procedure-codes';
const LIMIT = 50;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Service lines carry a CPT or HCPCS code in the same field, so search both and merge.
async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingProcedureCodesParams
): Promise<{ codes: BillingCodeOption[] }> {
  const [cpt, hcpcs] = await Promise.all([
    oystehr.terminology.searchCpt({ query: params.query, searchType: 'all', limit: LIMIT }),
    oystehr.terminology.searchHcpcs({ query: params.query, searchType: 'all', limit: LIMIT }),
  ]);

  const seen = new Set<string>();
  const codes: BillingCodeOption[] = [];
  for (const c of [...cpt.codes, ...hcpcs.codes]) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    codes.push({ code: c.code, display: c.display });
  }
  codes.sort((a, b) => a.code.localeCompare(b.code));
  return { codes };
}
