import { APIGatewayProxyResult } from 'aws-lambda';
import {
  APIError,
  APIErrorCode,
  CLAIM_NOT_READY_FOR_X12_EXPORT,
  ExportClaimX12Response,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getSecret,
  MISCONFIGURED_ENVIRONMENT_ERROR,
  NOT_AUTHORIZED,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
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
    throw rcmErrorToApiError(response.status, message);
  }

  const { x12 } = (await response.json()) as ExportClaimX12Response;
  return { x12 };
}

function rcmErrorToApiError(status: number, message: string): APIError {
  if (status === 400 || status === 422) {
    return {
      ...RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(message || CLAIM_NOT_READY_FOR_X12_EXPORT.message),
      statusCode: status,
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: APIErrorCode.NOT_AUTHORIZED,
      statusCode: status,
      message: message || NOT_AUTHORIZED.message,
    };
  }
  if (status === 404) {
    return {
      ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(message || 'The claim to export could not be found'),
      statusCode: status,
    };
  }
  return {
    ...MISCONFIGURED_ENVIRONMENT_ERROR(message || 'Failed to generate X12 for this claim'),
    statusCode: status,
  };
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
