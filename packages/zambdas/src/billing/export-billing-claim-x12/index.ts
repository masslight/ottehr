import { APIGatewayProxyResult } from 'aws-lambda';
import {
  APIError,
  APIErrorCode,
  CLAIM_NOT_READY_FOR_X12_EXPORT,
  ExportClaimX12Response,
  getSecret,
  SecretsKeys,
} from 'utils';
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
    const message = await parseRcmErrorMessage(response);
    console.error(`X12 generation failed for claim ${claimId}`, {
      status: response.status,
      statusText: response.statusText,
      message,
    });
    const code = response.status >= 500 ? APIErrorCode.MISCONFIGURED_ENVIRONMENT : CLAIM_NOT_READY_FOR_X12_EXPORT.code;
    throw {
      code,
      statusCode: response.status,
      message: message || CLAIM_NOT_READY_FOR_X12_EXPORT.message,
    } satisfies APIError;
  }

  const { x12 } = (await response.json()) as ExportClaimX12Response;
  return { x12 };
}

async function parseRcmErrorMessage(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const maybeParsedJson = JSON.parse(body) as { message?: string };
    return maybeParsedJson.message ?? body;
  } catch {
    return body;
  }
}
