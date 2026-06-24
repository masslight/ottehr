import { APIGatewayProxyResult } from 'aws-lambda';
import { ExportClaimX12Response, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { ExportClaimX12Params, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'export-billing-claim-x12';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);

  const response = await performEffect(params, m2mToken);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(params: ExportClaimX12Params, token: string): Promise<ExportClaimX12Response> {
  const { claimId, secrets } = params;
  const projectApiUrl = getSecret(SecretsKeys.PROJECT_API, secrets);

  // todo replace with sdk call
  const response = await fetch(`${projectApiUrl}/rcm/claim/${claimId}/x12`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to generate X12 for claim ${claimId}: ${response.status} ${response.statusText} ${body}`);
  }

  const { x12 } = (await response.json()) as ExportClaimX12Response;
  return { x12 };
}
