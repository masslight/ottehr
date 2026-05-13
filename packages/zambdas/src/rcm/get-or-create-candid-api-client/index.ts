import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApiClient } from 'candidhealth';
import {
  CandidToken,
  createCandidApiClient,
  GetOrCreateCandidApiClientZambdaOutput,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';

interface ValidatedInput {
  secrets: Secrets;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let cachedToken: CandidToken | undefined;
let inflightRefresh: Promise<CandidToken> | undefined;
let candidApiClient: CandidApiClient | undefined;

const FIVE_MINUTES = 5 * 60 * 1000;

const ZAMBDA_NAME = 'get-or-create-candid-api-client';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedInput = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', validatedInput);

  console.group('performEffect');
  const body = await performEffect(validatedInput);
  console.groupEnd();
  console.debug('performEffect success', body);

  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
});

function validateRequestParameters(input: ZambdaInput): ValidatedInput {
  const { secrets } = input;

  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const { CANDID_CLIENT_ID, CANDID_CLIENT_SECRET, CANDID_ENV } = secrets;
  if (!CANDID_CLIENT_ID || !CANDID_CLIENT_SECRET || !CANDID_ENV) {
    throw new Error('Missing required secrets');
  }

  return {
    secrets: {
      CANDID_CLIENT_ID,
      CANDID_CLIENT_SECRET,
      CANDID_ENV,
    },
  };
}

async function performEffect(validatedInput: ValidatedInput): Promise<GetOrCreateCandidApiClientZambdaOutput> {
  const { secrets } = validatedInput;

  if (!cachedToken || cachedToken.expiresAt.getTime() - FIVE_MINUTES <= Date.now()) {
    cachedToken = await refreshToken(secrets);
  }

  return {
    accessToken: cachedToken.accessToken,
    expiresAt: cachedToken.expiresAt.toISOString(),
  };
}

async function refreshToken(secrets: Secrets): Promise<CandidToken> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    if (!candidApiClient) {
      console.group('creating candid api client');
      candidApiClient = createCandidApiClient(secrets);
      console.groupEnd();
      console.debug('creating candid api client success');
    }

    const response = await candidApiClient.auth.default.getToken({
      clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
      clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Candid OAuth token: ${JSON.stringify(response.error)}`);
    }

    return {
      accessToken: response.body.accessToken,
      expiresAt: new Date(Date.now() + response.body.expiresIn * 1000),
    };
  })().finally(() => {
    inflightRefresh = undefined;
  });
  return inflightRefresh;
}
