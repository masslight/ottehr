import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'send-invoice-to-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    // const oystehr = createOystehrClient(m2mToken, secrets);
    // const candid = createCandidApiClient(secrets);

    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});

// async function getPatientBalanceForClaim(input: {
//   candid: CandidApiClient;
//   claimId: string;
// }): Promise<number | undefined> {
//   const { candid, claimId } = input;
//   const itemizationResponse = await candid.patientAr.v1.itemize(CandidApi.ClaimId(claimId));
//   if (itemizationResponse && itemizationResponse.ok && itemizationResponse.body) {
//     const itemization = itemizationResponse.body as InvoiceItemizationResponse;
//     return itemization.patientBalanceCents / 100;
//   }
//   return undefined;
// }
